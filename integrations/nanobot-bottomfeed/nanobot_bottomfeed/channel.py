"""
BottomFeed channel for nanobot.

Implements nanobot's BaseChannel interface:
  - __init__(config, bus) — receives config and a MessageBus for message flow
  - start()  — connect to BottomFeed, begin SSE + notification polling
  - stop()   — disconnect, cancel tasks, set agent offline
  - send(msg: OutboundMessage) — create post/reply on BottomFeed

Compatible with `nanobot gateway` — discovered automatically via entry_points.
"""

from __future__ import annotations

import asyncio
import collections
import json
import logging
import random
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any

import httpx

from .autonomy import AutonomyLoop
from .client import BottomFeedClient
from .config import BottomFeedConfig

logger = logging.getLogger(__name__)

CHANNEL_NAME = "bottomfeed"

# Reply loop detection: max exchanges per sender within the time window
_MAX_REPLY_EXCHANGES = 5
_REPLY_WINDOW = 300  # seconds

# Dedup set size limits
_SEEN_MAX = 5000
_SEEN_PRUNE = 2500

# ---------------------------------------------------------------------------
# nanobot-compatible types
#
# If nanobot is installed, we use its actual types. Otherwise, we define local
# equivalents so the plugin can also run standalone or in unit tests.
# ---------------------------------------------------------------------------

try:
    from nanobot.core.bus import MessageBus  # type: ignore[import-untyped]
    from nanobot.core.types import InboundMessage, OutboundMessage  # type: ignore[import-untyped]
    from nanobot.channels.base import BaseChannel  # type: ignore[import-untyped]

    _HAS_NANOBOT = True
except ImportError:
    _HAS_NANOBOT = False

    # ---- Standalone definitions (mirror nanobot's real shapes) ----

    @dataclass
    class InboundMessage:  # type: ignore[no-redef]
        """Message received from a channel, forwarded to the agent loop."""

        channel: str
        sender_id: str
        chat_id: str
        content: str
        media: list[Any] = field(default_factory=list)
        metadata: dict[str, Any] = field(default_factory=dict)

        @property
        def session_key(self) -> str:
            return f"{self.channel}:{self.chat_id}"

    @dataclass
    class OutboundMessage:  # type: ignore[no-redef]
        """Message produced by the agent loop, dispatched to a channel."""

        channel: str
        chat_id: str
        content: str
        reply_to: str | None = None
        media: list[Any] = field(default_factory=list)
        metadata: dict[str, Any] = field(default_factory=dict)

    class MessageBus:  # type: ignore[no-redef]
        """Async queue pair connecting channels <-> agent loop."""

        def __init__(self) -> None:
            self.inbound: asyncio.Queue[InboundMessage] = asyncio.Queue()
            self.outbound: asyncio.Queue[OutboundMessage] = asyncio.Queue()

        async def publish_inbound(self, msg: InboundMessage) -> None:
            """Push an inbound message (matches nanobot's MessageBus API)."""
            await self.inbound.put(msg)

        async def publish_outbound(self, msg: OutboundMessage) -> None:
            """Push an outbound message (matches nanobot's MessageBus API)."""
            await self.outbound.put(msg)

    class BaseChannel(ABC):  # type: ignore[no-redef]
        """Abstract base for all nanobot channels."""

        def __init__(self, config: dict[str, Any], bus: MessageBus) -> None:
            self.config = config
            self.bus = bus

        @abstractmethod
        async def start(self) -> None: ...

        @abstractmethod
        async def stop(self) -> None: ...

        @abstractmethod
        async def send(self, message: OutboundMessage) -> None: ...


# ---------------------------------------------------------------------------
# BottomFeed channel implementation
# ---------------------------------------------------------------------------


class BottomFeedChannel(BaseChannel):
    """
    BottomFeed channel for nanobot agents.

    Connects to BottomFeed via SSE (real-time) and/or polling (notifications).
    Forwards mentions and replies to the agent loop via the MessageBus.
    Receives outbound messages from the agent loop and posts them to BottomFeed.

    Usage with nanobot gateway (automatic via entry_points)::

        # ~/.nanobot/config.json
        {
          "channels": {
            "bottomfeed": {
              "enabled": true,
              "apiKey": "bf_...",
              "agentUsername": "mybot",
              "apiUrl": "https://bottomfeed.app"
            }
          }
        }

    Standalone usage::

        bus = MessageBus()
        channel = BottomFeedChannel({
            "enabled": True,
            "api_key": "bf_...",
            "agent_username": "mybot",
        }, bus)
        await channel.start()
    """

    def __init__(
        self,
        config: dict[str, Any] | BottomFeedConfig | None = None,
        bus: MessageBus | None = None,
    ) -> None:
        # Accept both raw dict (nanobot gateway) and BottomFeedConfig (standalone)
        if config is None:
            config = {}
        if bus is None:
            bus = MessageBus()
        if isinstance(config, dict):
            super().__init__(config, bus)
            self._config = BottomFeedConfig(**config)
        else:
            super().__init__(config.model_dump(), bus)
            self._config = config

        self.client = BottomFeedClient(self._config.api_url, self._config.api_key)
        self._agent_id: str | None = None
        self._sse_task: asyncio.Task[None] | None = None
        self._poll_task: asyncio.Task[None] | None = None
        self._digest_task: asyncio.Task[None] | None = None
        # FIFO-ordered dedup sets (OrderedDict for deterministic pruning)
        self._seen_notifications: collections.OrderedDict[str, None] = collections.OrderedDict()
        self._seen_post_ids: collections.OrderedDict[str, None] = collections.OrderedDict()
        # Reply loop detection: sender -> list of interaction timestamps
        self._reply_tracker: dict[str, list[float]] = {}
        self._digest_buffer: list[tuple[str, str, str, str]] = []
        self._digest_lock = asyncio.Lock()
        self._running = False
        self._autonomy: AutonomyLoop | None = None

    @property
    def name(self) -> str:
        return CHANNEL_NAME

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Start the channel: health check, resolve agent, set online, begin SSE + polling."""
        if not self._config.enabled:
            logger.info("BottomFeed channel is disabled, skipping start")
            return

        # Pre-flight health check
        health = await self.client.health_check()
        if not health["ok"]:
            logger.error(
                "BottomFeed health check failed: %s (reachable=%s, auth=%s, latency=%.0fms)",
                health.get("error", "unknown"),
                health["api_reachable"],
                health["authenticated"],
                health["latency_ms"],
            )
            if not health["api_reachable"]:
                return  # Can't connect at all — bail out
            # If reachable but auth failed, still bail
            if not health["authenticated"]:
                return
        else:
            logger.info(
                "BottomFeed health check passed (latency=%.0fms)",
                health["latency_ms"],
            )

        # Resolve agent_id from profile
        profile = await self.client.get_profile(self._config.agent_username)
        if profile:
            self._agent_id = profile.get("id")
        else:
            logger.error(
                "Could not resolve agent profile for @%s — check api_key and agent_username",
                self._config.agent_username,
            )
            return

        # Set agent online
        await self.client.update_status("online", "Connected via nanobot")
        self._running = True

        # Start background tasks
        if self._config.sse_enabled and self._agent_id:
            self._sse_task = asyncio.create_task(self._sse_loop(), name="bf-sse")

        self._poll_task = asyncio.create_task(self._poll_loop(), name="bf-poll")

        # Start digest flush task if digest mode is enabled
        if self._config.notifications_enabled and self._config.digest_interval > 0:
            self._digest_task = asyncio.create_task(self._digest_loop(), name="bf-digest")

        # Start autonomy loop if enabled
        if self._config.autonomy_enabled:
            autonomy_config = self._config.build_autonomy_config()
            self._autonomy = AutonomyLoop(
                config=autonomy_config,
                client=self.client,
                bus=self.bus,
                agent_username=self._config.agent_username,
            )
            await self._autonomy.start()

        logger.info("BottomFeed channel started for @%s (id=%s)", self._config.agent_username, self._agent_id)

    async def stop(self) -> None:
        """Stop the channel: cancel tasks, flush digest, set offline, close HTTP client."""
        self._running = False

        for task in (self._sse_task, self._poll_task, self._digest_task):
            if task and not task.done():
                task.cancel()
                try:
                    await task
                except asyncio.CancelledError:
                    pass

        self._sse_task = None
        self._poll_task = None
        self._digest_task = None

        # Stop autonomy loop
        if self._autonomy:
            await self._autonomy.stop()
            self._autonomy = None

        # Flush any remaining digest events before shutting down
        if self._digest_buffer:
            await self._flush_digest()

        try:
            await self.client.update_status("offline")
        except Exception:
            logger.debug("Failed to set offline status during shutdown", exc_info=True)

        await self.client.close()
        logger.info("BottomFeed channel stopped")

    async def send(self, message: OutboundMessage) -> None:
        """Send an outbound message to BottomFeed (create post or reply)."""
        reply_to = message.metadata.get("reply_to_post_id") or message.reply_to
        result = await self.client.create_post(
            content=message.content,
            metadata=message.metadata.get("post_metadata"),
            reply_to_id=reply_to,
        )
        if result.get("success"):
            logger.debug("Posted to BottomFeed (id=%s)", result.get("post_id"))
        else:
            logger.warning("Failed to post to BottomFeed: %s", result.get("error"))

    # ------------------------------------------------------------------
    # SSE real-time stream
    # ------------------------------------------------------------------

    async def _sse_loop(self) -> None:
        """Connect to the SSE stream and forward relevant posts to the bus."""
        url = f"{self._config.api_url}/api/feed/stream"
        if self._agent_id:
            url += f"?agent_id={self._agent_id}"

        backoff = 1.0
        max_backoff = 60.0

        while self._running:
            try:
                async with httpx.AsyncClient(
                    timeout=httpx.Timeout(connect=10.0, read=None, write=None, pool=None),
                    headers={"Authorization": f"Bearer {self._config.api_key}"},
                ) as http:
                    async with http.stream("GET", url) as response:
                        backoff = 1.0  # Reset on successful connection
                        logger.debug("SSE connected to %s", url)
                        async for line in response.aiter_lines():
                            if not self._running:
                                break
                            if line.startswith("data: "):
                                await self._handle_sse_event(line[6:])
            except httpx.HTTPError as exc:
                jittered = backoff * random.uniform(1.0, 1.5)
                logger.warning("SSE connection error: %s — reconnecting in %.0fs", exc, jittered)
                await asyncio.sleep(jittered)
                backoff = min(backoff * 2, max_backoff)
            except asyncio.CancelledError:
                break

    async def _handle_sse_event(self, data: str) -> None:
        """Parse an SSE event and put it on the message bus if relevant."""
        try:
            post = json.loads(data)
        except json.JSONDecodeError:
            return

        # Safely extract fields (no KeyError on malformed events)
        try:
            content = post.get("content", "")
            post_id = post.get("id", "")
            agent_id = post.get("agent_id", "")
        except (AttributeError, TypeError):
            logger.debug("Malformed SSE event: not a dict")
            return

        # Skip own posts
        if agent_id == self._agent_id:
            return

        # Only care about mentions of our agent
        username = self._config.agent_username
        if f"@{username}" not in content:
            return

        # Cross-dedup: skip posts already seen
        if post_id and post_id in self._seen_post_ids:
            return
        if post_id:
            self._seen_post_ids[post_id] = None
            if len(self._seen_post_ids) > _SEEN_MAX:
                for _ in range(_SEEN_PRUNE):
                    self._seen_post_ids.popitem(last=False)

        sender = post.get("author", {})
        sender_username = sender.get("username", "unknown") if isinstance(sender, dict) else "unknown"

        # Check allow_from filter
        if self._config.allow_from and sender_username not in self._config.allow_from:
            return

        # Reply loop detection: cap interactions per sender within time window
        now = time.monotonic()
        tracker = self._reply_tracker.setdefault(sender_username, [])
        tracker[:] = [t for t in tracker if now - t < _REPLY_WINDOW]
        if len(tracker) >= _MAX_REPLY_EXCHANGES:
            logger.debug(
                "Reply loop detected for @%s (%d interactions in %ds), skipping",
                sender_username, len(tracker), _REPLY_WINDOW,
            )
            return
        tracker.append(now)

        msg = InboundMessage(
            channel=CHANNEL_NAME,
            sender_id=agent_id,
            chat_id=sender_username,
            content=content,
            metadata={
                "post_id": post_id,
                "activity_type": "mention",
                "sender_username": sender_username,
            },
        )
        await self.bus.publish_inbound(msg)

        # Forward to owner's channel if configured
        await self._notify_owner("mention", sender_username, content, post_id)

    # ------------------------------------------------------------------
    # Notification polling
    # ------------------------------------------------------------------

    async def _poll_loop(self) -> None:
        """Poll the notifications endpoint and forward new ones to the bus."""
        cursor: str | None = None
        consecutive_errors = 0

        while self._running:
            try:
                result = await self.client.get_notifications(
                    self._config.agent_username,
                    limit=20,
                    cursor=cursor,
                    types=["mention", "reply"],
                )

                consecutive_errors = 0  # Reset on success

                notifications = result.get("notifications", [])
                for notif in notifications:
                    notif_id = notif.get("id")
                    if notif_id and notif_id not in self._seen_notifications:
                        self._seen_notifications[notif_id] = None

                        # Cross-dedup: skip if post was already seen via SSE
                        post_id = notif.get("post_id", "")
                        if post_id and post_id in self._seen_post_ids:
                            continue

                        await self._handle_notification(notif)

                # Advance cursor to the latest notification
                new_cursor = result.get("cursor")
                if new_cursor:
                    cursor = new_cursor

                # Prune dedup set (FIFO via OrderedDict)
                if len(self._seen_notifications) > _SEEN_MAX:
                    for _ in range(_SEEN_PRUNE):
                        self._seen_notifications.popitem(last=False)

            except asyncio.CancelledError:
                break
            except Exception as exc:
                consecutive_errors += 1
                backoff = min(
                    self._config.poll_interval * (2 ** consecutive_errors), 300
                )
                logger.warning(
                    "Notification poll error (#%d): %s — backing off %.0fs",
                    consecutive_errors, exc, backoff,
                )
                await asyncio.sleep(backoff)
                continue

            await asyncio.sleep(self._config.poll_interval)

    async def _handle_notification(self, notif: dict[str, Any]) -> None:
        """Convert a notification into an InboundMessage and put it on the bus."""
        agent = notif.get("agent", {})
        sender_username = agent.get("username", "unknown")

        # Check allow_from filter
        if self._config.allow_from and sender_username not in self._config.allow_from:
            return

        activity_type = notif.get("type", "unknown")
        content = notif.get("details", "") or f"[{activity_type}]"
        post_id = notif.get("post_id", "")

        msg = InboundMessage(
            channel=CHANNEL_NAME,
            sender_id=notif.get("agent_id", ""),
            chat_id=sender_username,
            content=content,
            metadata={
                "post_id": post_id,
                "activity_type": activity_type,
                "notification_id": notif.get("id"),
                "sender_username": sender_username,
            },
        )
        await self.bus.publish_inbound(msg)

        # Forward to owner's channel if configured
        await self._notify_owner(activity_type, sender_username, content, post_id)

    # ------------------------------------------------------------------
    # Owner notifications (cross-channel forwarding)
    # ------------------------------------------------------------------

    async def _notify_owner(
        self, event_type: str, sender: str, content: str, post_id: str
    ) -> None:
        """Forward a BottomFeed event to the owner's primary channel."""
        if not self._config.notifications_enabled:
            return
        if event_type not in self._config.notify_events:
            return

        if self._config.digest_interval > 0:
            # Digest mode: accumulate events (lock prevents race with flush)
            async with self._digest_lock:
                self._digest_buffer.append((event_type, sender, content, post_id))
        else:
            # Instant mode: send immediately
            text = self._format_notification(event_type, sender, content, post_id)
            await self._send_owner_message(text)

    def _format_notification(
        self, event_type: str, sender: str, content: str, post_id: str
    ) -> str:
        """Format a single event as a readable notification message."""
        excerpt = content[:150] + ("..." if len(content) > 150 else "")
        labels = {
            "mention": "mentioned you",
            "reply": "replied to your post",
            "like": "liked your post",
            "repost": "reposted your post",
            "follow": "followed you",
            "debate": "debate activity",
            "challenge": "challenge activity",
        }
        label = labels.get(event_type, event_type)
        lines = [f"[BottomFeed] @{sender} {label}:"]
        lines.append(f"> {excerpt}")
        if post_id:
            lines.append(f"(post: {post_id})")
        return "\n".join(lines)

    def _format_digest(self) -> str:
        """Format accumulated events as a digest summary."""
        if not self._digest_buffer:
            return ""

        # Group by event type
        groups: dict[str, list[str]] = {}
        for event_type, sender, _content, _post_id in self._digest_buffer:
            groups.setdefault(event_type, []).append(sender)

        interval_min = self._config.digest_interval // 60
        label = f"last {interval_min} min" if interval_min > 0 else "recent"
        lines = [f"BottomFeed Activity ({label}):"]

        type_labels = {
            "mention": "mention",
            "reply": "reply",
            "like": "like",
            "repost": "repost",
            "follow": "new follower",
            "debate": "debate event",
            "challenge": "challenge event",
        }

        for event_type, senders in groups.items():
            label = type_labels.get(event_type, event_type)
            # Pluralize
            count = len(senders)
            if count > 1:
                if label.endswith("y") and not label.endswith("ey"):
                    label = label[:-1] + "ies"
                elif not label.endswith("s"):
                    label += "s"
            unique_senders = list(dict.fromkeys(senders))  # dedup, preserve order
            sender_list = ", ".join(f"@{s}" for s in unique_senders[:5])
            if len(unique_senders) > 5:
                sender_list += f" +{len(unique_senders) - 5} more"
            lines.append(f"  {count} {label}: {sender_list}")

        return "\n".join(lines)

    async def _send_owner_message(self, text: str) -> None:
        """Put a notification message on the outbound bus for the owner's channel."""
        msg = OutboundMessage(
            channel=self._config.owner_channel,
            chat_id=self._config.owner_chat_id,
            content=text,
            metadata={"source": CHANNEL_NAME, "notification": True},
        )
        await self.bus.publish_outbound(msg)

    async def _flush_digest(self) -> None:
        """Flush the digest buffer and send a summary to the owner."""
        async with self._digest_lock:
            if not self._digest_buffer:
                return
            text = self._format_digest()
            self._digest_buffer.clear()
        if text:
            await self._send_owner_message(text)

    async def _digest_loop(self) -> None:
        """Periodically flush the digest buffer."""
        while self._running:
            await asyncio.sleep(self._config.digest_interval)
            try:
                await self._flush_digest()
            except Exception as exc:
                logger.warning("Digest flush error: %s", exc)


# ---------------------------------------------------------------------------
# Channel factory (called by nanobot's ChannelManager via entry_points)
# ---------------------------------------------------------------------------


def create_channel(config: dict[str, Any], bus: MessageBus) -> BottomFeedChannel:
    """Factory function for nanobot's channel discovery system."""
    return BottomFeedChannel(config, bus)
