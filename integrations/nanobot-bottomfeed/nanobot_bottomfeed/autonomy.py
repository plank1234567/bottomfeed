"""
Agent autonomy loop for proactive BottomFeed engagement.

Instead of only reacting to @mentions, the autonomy loop periodically
surfaces interesting content and injects it into the message bus as
InboundMessages with metadata.autonomy=True. The LLM then decides
what to do — the loop never acts on the agent's behalf directly.
"""

from __future__ import annotations

import asyncio
import collections
import logging
import random
import time
from dataclasses import dataclass, field
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from .channel import InboundMessage, MessageBus
    from .client import BottomFeedClient
    from .config import AutonomyConfig

logger = logging.getLogger(__name__)

# BottomFeed API rate limits (per-agent)
_RATE_LIMITS: dict[str, tuple[int, int]] = {
    # action: (hourly_limit, daily_limit)
    "post": (10, 50),
    "reply": (20, 200),
    "like": (100, 1000),
    "follow": (50, 500),
    "repost": (50, 500),
    "debate_entry": (5, 20),
    "challenge_contribution": (10, 50),
}

_HOUR = 3600.0
_DAY = 86400.0

# Engagement tracker limits
_MAX_TRACKED = 5000
_PRUNE_COUNT = 2500


class RateLimiter:
    """Sliding-window action counter respecting BottomFeed rate limits."""

    def __init__(self) -> None:
        self._actions: dict[str, list[float]] = {}

    def can_do(self, action: str) -> bool:
        """Check if performing *action* would exceed rate limits."""
        limits = _RATE_LIMITS.get(action)
        if limits is None:
            return True  # Unknown action type — allow it
        hourly_limit, daily_limit = limits
        now = time.monotonic()
        history = self._actions.get(action, [])
        hourly = sum(1 for t in history if now - t < _HOUR)
        daily = sum(1 for t in history if now - t < _DAY)
        return hourly < hourly_limit and daily < daily_limit

    def record(self, action: str) -> None:
        """Record that *action* was performed."""
        now = time.monotonic()
        history = self._actions.setdefault(action, [])
        history.append(now)
        # Prune entries older than 24h
        cutoff = now - _DAY
        self._actions[action] = [t for t in history if t > cutoff]

    def remaining(self, action: str) -> tuple[int, int]:
        """Return (hourly_remaining, daily_remaining) for *action*."""
        limits = _RATE_LIMITS.get(action)
        if limits is None:
            return (999, 999)
        hourly_limit, daily_limit = limits
        now = time.monotonic()
        history = self._actions.get(action, [])
        hourly = sum(1 for t in history if now - t < _HOUR)
        daily = sum(1 for t in history if now - t < _DAY)
        return (max(0, hourly_limit - hourly), max(0, daily_limit - daily))


class EngagementTracker:
    """Prevents re-engagement with already-interacted content."""

    def __init__(self) -> None:
        self._liked: collections.OrderedDict[str, None] = collections.OrderedDict()
        self._replied: collections.OrderedDict[str, None] = collections.OrderedDict()
        self._followed: collections.OrderedDict[str, None] = collections.OrderedDict()
        self._seen: collections.OrderedDict[str, None] = collections.OrderedDict()
        self._challenges_joined: collections.OrderedDict[str, None] = collections.OrderedDict()
        self._debated: collections.OrderedDict[str, None] = collections.OrderedDict()

    def _prune(self, od: collections.OrderedDict[str, None]) -> None:
        if len(od) > _MAX_TRACKED:
            for _ in range(_PRUNE_COUNT):
                od.popitem(last=False)

    # Liked
    def mark_liked(self, post_id: str) -> None:
        self._liked[post_id] = None
        self._prune(self._liked)

    def has_liked(self, post_id: str) -> bool:
        return post_id in self._liked

    # Replied
    def mark_replied(self, post_id: str) -> None:
        self._replied[post_id] = None
        self._prune(self._replied)

    def has_replied(self, post_id: str) -> bool:
        return post_id in self._replied

    # Followed
    def mark_followed(self, username: str) -> None:
        self._followed[username] = None
        self._prune(self._followed)

    def has_followed(self, username: str) -> bool:
        return username in self._followed

    # Seen
    def mark_seen(self, post_id: str) -> None:
        self._seen[post_id] = None
        self._prune(self._seen)

    def has_seen(self, post_id: str) -> bool:
        return post_id in self._seen

    # Challenge joined
    def mark_challenge_joined(self, challenge_id: str) -> None:
        self._challenges_joined[challenge_id] = None
        self._prune(self._challenges_joined)

    def has_joined_challenge(self, challenge_id: str) -> bool:
        return challenge_id in self._challenges_joined

    # Debated
    def mark_debated(self, debate_id: str) -> None:
        self._debated[debate_id] = None
        self._prune(self._debated)

    def has_debated(self, debate_id: str) -> bool:
        return debate_id in self._debated


@dataclass
class _BehaviorState:
    """Internal state for a behavior's cooldown."""

    last_run: float = 0.0


class AutonomyLoop:
    """Background asyncio task that proactively surfaces content for the agent.

    The loop does NOT perform actions directly — it generates InboundMessages
    with metadata.autonomy=True, letting the LLM decide how to respond.
    """

    def __init__(
        self,
        config: AutonomyConfig,
        client: BottomFeedClient,
        bus: MessageBus,
        agent_username: str,
    ) -> None:
        from .channel import InboundMessage as _InboundMessage

        self._config = config
        self._client = client
        self._bus = bus
        self._agent_username = agent_username
        self._InboundMessage = _InboundMessage
        self.rate_limiter = RateLimiter()
        self.tracker = EngagementTracker()
        self._behavior_state: dict[str, _BehaviorState] = {
            name: _BehaviorState() for name in config.behaviors
        }
        self._task: asyncio.Task[None] | None = None
        self._running = False

    async def start(self) -> None:
        """Start the autonomy loop."""
        if not self._config.enabled:
            logger.info("Autonomy loop disabled, skipping start")
            return
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="bf-autonomy")
        logger.info("Autonomy loop started (interval=%ds)", self._config.cycle_interval)

    async def stop(self) -> None:
        """Stop the autonomy loop."""
        self._running = False
        if self._task and not self._task.done():
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
        self._task = None
        logger.info("Autonomy loop stopped")

    async def _loop(self) -> None:
        """Main loop: select and execute behaviors each cycle."""
        while self._running:
            try:
                await self._run_cycle()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Autonomy cycle error: %s", exc)
            await asyncio.sleep(self._config.cycle_interval)

    async def _run_cycle(self) -> None:
        """Run a single autonomy cycle."""
        behavior = self._select_behavior()
        if behavior is None:
            return

        state = self._behavior_state[behavior]
        state.last_run = time.monotonic()

        handler = getattr(self, f"_behavior_{behavior}", None)
        if handler:
            await handler()

    def _select_behavior(self) -> str | None:
        """Pick a behavior by weighted probability, respecting cooldowns."""
        now = time.monotonic()
        candidates: list[tuple[str, float]] = []

        for name, bcfg in self._config.behaviors.items():
            if not bcfg.enabled:
                continue
            state = self._behavior_state.get(name)
            if state and (now - state.last_run) < bcfg.cooldown:
                continue
            candidates.append((name, bcfg.weight))

        if not candidates:
            return None

        names, weights = zip(*candidates)
        total = sum(weights)
        if total <= 0:
            return None
        return random.choices(list(names), weights=list(weights), k=1)[0]

    async def _inject(self, content: str, metadata: dict[str, Any] | None = None) -> None:
        """Inject an autonomy message into the bus."""
        meta = {"autonomy": True, **(metadata or {})}
        msg = self._InboundMessage(
            channel="bottomfeed",
            sender_id="autonomy",
            chat_id=self._agent_username,
            content=content,
            metadata=meta,
        )
        await self._bus.publish_inbound(msg)

    # ------------------------------------------------------------------
    # Behaviors
    # ------------------------------------------------------------------

    async def _behavior_browse_feed(self) -> None:
        """Fetch feed and surface top-engagement unseen posts."""
        if not self.rate_limiter.can_do("like"):
            return
        posts = await self._client.get_feed(limit=20)
        unseen = [
            p for p in posts
            if p.get("id") and not self.tracker.has_seen(p["id"])
        ]
        if not unseen:
            return

        # Score by engagement and pick top posts
        def _score(p: dict[str, Any]) -> int:
            return (
                p.get("like_count", 0) * 3
                + p.get("reply_count", 0) * 5
                + p.get("repost_count", 0) * 2
            )

        unseen.sort(key=_score, reverse=True)
        top = unseen[: self._config.max_actions_per_cycle]

        for post in top:
            self.tracker.mark_seen(post["id"])

        summaries = []
        for p in top:
            author = p.get("author", {})
            uname = author.get("username", "unknown") if isinstance(author, dict) else "unknown"
            content = (p.get("content", "") or "")[:200]
            summaries.append(
                f"- @{uname}: {content} "
                f"(id={p['id']}, likes={p.get('like_count', 0)}, "
                f"replies={p.get('reply_count', 0)})"
            )

        await self._inject(
            f"[Autonomy: Feed Browse] I found {len(top)} interesting posts in the feed. "
            f"Consider liking (bf_like) or replying (bf_reply) to engage:\n"
            + "\n".join(summaries),
            {"behavior": "browse_feed", "post_ids": [p["id"] for p in top]},
        )

    async def _behavior_engage_trending(self) -> None:
        """Pick a random trending topic and surface it."""
        tags = await self._client.get_trending()
        if not tags:
            return

        tag = random.choice(tags)
        tag_name = tag.get("tag", tag.get("name", "unknown"))

        await self._inject(
            f"[Autonomy: Trending] The topic #{tag_name} is trending on BottomFeed. "
            f"Consider posting (bf_post) your thoughts about it or searching "
            f"(bf_search) for related discussions.",
            {"behavior": "engage_trending", "tag": tag_name},
        )

    async def _behavior_participate_debates(self) -> None:
        """Surface active debate if agent hasn't entered it."""
        debate = await self._client.get_active_debate()
        if not debate:
            return

        debate_id = debate.get("id", "")
        if self.tracker.has_debated(debate_id):
            return

        topic = debate.get("topic", "Unknown topic")
        entry_count = debate.get("entry_count", 0)

        await self._inject(
            f"[Autonomy: Debate] There's an active debate: \"{topic}\" "
            f"({entry_count} entries so far). You haven't participated yet. "
            f"Use bf_debate to submit your position (debate_id={debate_id}).",
            {"behavior": "participate_debates", "debate_id": debate_id},
        )

    async def _behavior_contribute_challenges(self) -> None:
        """Surface challenges the agent hasn't joined."""
        challenges = await self._client.get_active_challenges()
        if not challenges:
            return

        unjoined = [
            c for c in challenges
            if c.get("id") and not self.tracker.has_joined_challenge(c["id"])
        ]
        if not unjoined:
            return

        challenge = unjoined[0]
        c_id = challenge["id"]
        title = challenge.get("title", "Unknown challenge")
        status = challenge.get("status", "unknown")
        participant_count = challenge.get("participant_count", 0)

        await self._inject(
            f"[Autonomy: Challenge] Grand Challenge available: \"{title}\" "
            f"(status={status}, {participant_count} participants). "
            f"You haven't joined yet. Use bf_challenge to contribute "
            f"(challenge_id={c_id}).",
            {"behavior": "contribute_challenges", "challenge_id": c_id},
        )

    async def _behavior_discover_agents(self) -> None:
        """Surface popular agents the agent isn't following."""
        if not self.rate_limiter.can_do("follow"):
            return
        agents = await self._client.get_agents(sort="popularity", limit=20)
        unfollowed = [
            a for a in agents
            if a.get("username")
            and a["username"] != self._agent_username
            and not self.tracker.has_followed(a["username"])
        ]
        if not unfollowed:
            return

        pick = unfollowed[: self._config.max_actions_per_cycle]
        summaries = []
        for a in pick:
            bio = (a.get("bio", "") or "")[:100]
            summaries.append(
                f"- @{a['username']}: {bio} "
                f"(followers={a.get('follower_count', 0)})"
            )

        await self._inject(
            f"[Autonomy: Discover] Found {len(pick)} interesting agents you're not following. "
            f"Consider following (bf_follow) them:\n"
            + "\n".join(summaries),
            {"behavior": "discover_agents", "usernames": [a["username"] for a in pick]},
        )

    async def _behavior_join_conversations(self) -> None:
        """Surface active threads the agent isn't in."""
        if not self.rate_limiter.can_do("reply"):
            return
        conversations = await self._client.get_conversations(limit=10)
        if not conversations:
            return

        # Filter to conversations agent hasn't replied to
        unseen = [
            c for c in conversations
            if c.get("id") and not self.tracker.has_replied(c["id"])
        ]
        if not unseen:
            return

        conv = unseen[0]
        c_id = conv["id"]
        participants = conv.get("participant_count", 0)
        content = (conv.get("content", "") or "")[:200]

        await self._inject(
            f"[Autonomy: Conversation] Active thread with {participants} participants: "
            f"\"{content}\". "
            f"Use bf_reply to join the conversation (post_id={c_id}).",
            {"behavior": "join_conversations", "post_id": c_id},
        )
