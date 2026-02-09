"""Tests for the BottomFeed channel (nanobot BaseChannel interface)."""

import asyncio
import json
import time
from unittest.mock import AsyncMock, patch, MagicMock

import pytest

from nanobot_bottomfeed.channel import (
    BottomFeedChannel,
    MessageBus,
    InboundMessage,
    OutboundMessage,
    CHANNEL_NAME,
    _MAX_REPLY_EXCHANGES,
    _REPLY_WINDOW,
    _SEEN_MAX,
    create_channel,
)
from nanobot_bottomfeed.config import BottomFeedConfig


@pytest.fixture
def bus():
    return MessageBus()


@pytest.fixture
def config():
    return BottomFeedConfig(
        enabled=True,
        api_url="https://bottomfeed.test",
        api_key="bf_test_key",
        agent_username="testbot",
        poll_interval=5,
        sse_enabled=False,
    )


@pytest.fixture
def channel(bus: MessageBus, config: BottomFeedConfig):
    return BottomFeedChannel(config, bus)


class TestChannelInit:
    def test_creates_with_config(self, channel: BottomFeedChannel):
        assert channel._config.agent_username == "testbot"
        assert channel._config.api_url == "https://bottomfeed.test"
        assert channel.name == CHANNEL_NAME

    def test_creates_from_dict(self, bus: MessageBus):
        ch = BottomFeedChannel({
            "enabled": True,
            "api_url": "https://bf.test",
            "api_key": "bf_key",
            "agent_username": "bot",
            "poll_interval": 10,
        }, bus)
        assert ch._config.agent_username == "bot"
        assert ch._config.api_url == "https://bf.test"

    def test_creates_from_camelcase_dict(self, bus: MessageBus):
        """nanobot gateway passes camelCase JSON config."""
        ch = BottomFeedChannel({
            "enabled": True,
            "apiUrl": "https://bf.test",
            "apiKey": "bf_key",
            "agentUsername": "bot",
            "pollInterval": 10,
        }, bus)
        assert ch._config.agent_username == "bot"
        assert ch._config.api_url == "https://bf.test"

    def test_disabled_channel(self, bus: MessageBus):
        ch = BottomFeedChannel({"enabled": False}, bus)
        assert ch._config.enabled is False

    def test_has_message_bus(self, channel: BottomFeedChannel, bus: MessageBus):
        assert channel.bus is bus


class TestCreateChannelFactory:
    def test_factory(self, bus: MessageBus):
        ch = create_channel({
            "enabled": True,
            "api_url": "https://bf.test",
            "api_key": "bf_key",
            "agent_username": "bot",
        }, bus)
        assert isinstance(ch, BottomFeedChannel)
        assert ch.bus is bus


class TestChannelStart:
    async def test_start_sets_online(self, channel: BottomFeedChannel):
        with (
            patch.object(channel.client, "health_check", new_callable=AsyncMock) as mock_health,
            patch.object(channel.client, "get_profile", new_callable=AsyncMock) as mock_profile,
            patch.object(channel.client, "update_status", new_callable=AsyncMock) as mock_status,
            patch.object(channel, "_poll_loop", new_callable=AsyncMock),
        ):
            mock_health.return_value = {"ok": True, "api_reachable": True, "authenticated": True, "latency_ms": 42.0}
            mock_profile.return_value = {"id": "agent-123", "username": "testbot"}
            await channel.start()

            mock_health.assert_called_once()
            mock_status.assert_called_with("online", "Connected via nanobot")
            assert channel._agent_id == "agent-123"
            assert channel._running is True

            # Clean up
            channel._running = False
            if channel._poll_task:
                channel._poll_task.cancel()
                try:
                    await channel._poll_task
                except asyncio.CancelledError:
                    pass

    async def test_start_disabled(self, bus: MessageBus):
        ch = BottomFeedChannel({"enabled": False}, bus)
        await ch.start()
        assert ch._running is False

    async def test_start_fails_on_health_check(self, channel: BottomFeedChannel):
        """Channel should not start if health check fails."""
        with (
            patch.object(channel.client, "health_check", new_callable=AsyncMock) as mock_health,
            patch.object(channel.client, "get_profile", new_callable=AsyncMock) as mock_profile,
        ):
            mock_health.return_value = {
                "ok": False, "api_reachable": False, "authenticated": False,
                "latency_ms": 0, "error": "API unreachable",
            }
            await channel.start()

            # Should NOT have tried to resolve profile
            mock_profile.assert_not_called()
            assert channel._running is False

    async def test_start_fails_on_auth(self, channel: BottomFeedChannel):
        """Channel should not start if authentication fails."""
        with (
            patch.object(channel.client, "health_check", new_callable=AsyncMock) as mock_health,
            patch.object(channel.client, "get_profile", new_callable=AsyncMock) as mock_profile,
        ):
            mock_health.return_value = {
                "ok": False, "api_reachable": True, "authenticated": False,
                "latency_ms": 50.0, "error": "Authentication failed",
            }
            await channel.start()

            mock_profile.assert_not_called()
            assert channel._running is False


class TestChannelStop:
    async def test_stop_sets_offline(self, channel: BottomFeedChannel):
        with (
            patch.object(channel.client, "update_status", new_callable=AsyncMock) as mock_status,
            patch.object(channel.client, "close", new_callable=AsyncMock) as mock_close,
        ):
            channel._running = True
            await channel.stop()

            mock_status.assert_called_with("offline")
            mock_close.assert_called_once()
            assert channel._running is False


class TestChannelSend:
    async def test_send_creates_post(self, channel: BottomFeedChannel):
        with patch.object(channel.client, "create_post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {"success": True, "post_id": "post-1"}

            msg = OutboundMessage(
                channel=CHANNEL_NAME,
                chat_id="alice",
                content="Hello!",
            )
            await channel.send(msg)
            mock_post.assert_called_with(content="Hello!", metadata=None, reply_to_id=None)

    async def test_send_reply_via_metadata(self, channel: BottomFeedChannel):
        with patch.object(channel.client, "create_post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {"success": True, "post_id": "post-2"}

            msg = OutboundMessage(
                channel=CHANNEL_NAME,
                chat_id="alice",
                content="Reply!",
                metadata={"reply_to_post_id": "post-1"},
            )
            await channel.send(msg)
            mock_post.assert_called_with(content="Reply!", metadata=None, reply_to_id="post-1")

    async def test_send_reply_via_reply_to(self, channel: BottomFeedChannel):
        with patch.object(channel.client, "create_post", new_callable=AsyncMock) as mock_post:
            mock_post.return_value = {"success": True, "post_id": "post-2"}

            msg = OutboundMessage(
                channel=CHANNEL_NAME,
                chat_id="alice",
                content="Reply!",
                reply_to="post-1",
            )
            await channel.send(msg)
            mock_post.assert_called_with(content="Reply!", metadata=None, reply_to_id="post-1")


class TestSSEEventHandling:
    async def test_puts_mention_on_bus(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-1",
            "content": "Hey @testbot check this out!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })

        await channel._handle_sse_event(post_data)

        # Message should be on the inbound queue
        assert not bus.inbound.empty()
        msg: InboundMessage = bus.inbound.get_nowait()
        assert msg.channel == CHANNEL_NAME
        assert msg.chat_id == "alice"
        assert msg.sender_id == "agent-456"
        assert msg.session_key == "bottomfeed:alice"
        assert msg.metadata["post_id"] == "post-1"
        assert msg.metadata["activity_type"] == "mention"

    async def test_skips_own_posts(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-1",
            "content": "My own post @testbot",
            "agent_id": "agent-123",
            "author": {"username": "testbot"},
        })

        await channel._handle_sse_event(post_data)
        assert bus.inbound.empty()

    async def test_skips_non_mentions(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._agent_id = "agent-123"
        channel._config.agent_username = "testbot"

        post_data = json.dumps({
            "id": "post-1",
            "content": "Just a normal post",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })

        await channel._handle_sse_event(post_data)
        assert bus.inbound.empty()

    async def test_handles_invalid_json(self, channel: BottomFeedChannel, bus: MessageBus):
        await channel._handle_sse_event("not json")
        assert bus.inbound.empty()

    async def test_respects_allow_from(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._config.agent_username = "testbot"
        channel._config.allow_from = ["bob"]
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-1",
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })

        await channel._handle_sse_event(post_data)
        assert bus.inbound.empty()  # alice is not in allow_from


class TestNotificationHandling:
    async def test_puts_notification_on_bus(self, channel: BottomFeedChannel, bus: MessageBus):
        notif = {
            "id": "n1",
            "type": "mention",
            "agent_id": "agent-456",
            "post_id": "post-1",
            "details": "You were mentioned",
            "agent": {"username": "alice"},
        }

        await channel._handle_notification(notif)

        assert not bus.inbound.empty()
        msg: InboundMessage = bus.inbound.get_nowait()
        assert msg.channel == CHANNEL_NAME
        assert msg.chat_id == "alice"
        assert msg.session_key == "bottomfeed:alice"
        assert msg.metadata["activity_type"] == "mention"
        assert msg.metadata["notification_id"] == "n1"

    async def test_respects_allow_from(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._config.allow_from = ["bob"]

        notif = {
            "id": "n1",
            "type": "mention",
            "agent_id": "agent-456",
            "agent": {"username": "alice"},
        }

        await channel._handle_notification(notif)
        assert bus.inbound.empty()

    async def test_allows_if_in_allow_from(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._config.allow_from = ["alice"]

        notif = {
            "id": "n1",
            "type": "mention",
            "agent_id": "agent-456",
            "post_id": "p1",
            "agent": {"username": "alice"},
        }

        await channel._handle_notification(notif)
        assert not bus.inbound.empty()


class TestOwnerNotifications:
    """Cross-channel forwarding of BottomFeed events to the owner."""

    @pytest.fixture
    def notif_config(self):
        return BottomFeedConfig(
            enabled=True,
            api_url="https://bottomfeed.test",
            api_key="bf_test_key",
            agent_username="testbot",
            poll_interval=5,
            sse_enabled=False,
            owner_channel="telegram",
            owner_chat_id="12345",
            notify_events=["mention", "reply"],
            digest_interval=0,  # instant mode
        )

    @pytest.fixture
    def notif_channel(self, bus: MessageBus, notif_config: BottomFeedConfig):
        return BottomFeedChannel(notif_config, bus)

    async def test_instant_mention_puts_outbound_on_bus(
        self, notif_channel: BottomFeedChannel, bus: MessageBus
    ):
        notif_channel._config.agent_username = "testbot"
        notif_channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-1",
            "content": "Hey @testbot check this out!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })

        await notif_channel._handle_sse_event(post_data)

        # Inbound should have the mention
        assert not bus.inbound.empty()
        bus.inbound.get_nowait()

        # Outbound should have the owner notification
        assert not bus.outbound.empty()
        out = bus.outbound.get_nowait()
        assert out.channel == "telegram"
        assert out.chat_id == "12345"
        assert "@alice" in out.content
        assert "mentioned you" in out.content
        assert out.metadata["source"] == "bottomfeed"
        assert out.metadata["notification"] is True

    async def test_instant_reply_notification(
        self, notif_channel: BottomFeedChannel, bus: MessageBus
    ):
        notif = {
            "id": "n1",
            "type": "reply",
            "agent_id": "agent-456",
            "post_id": "post-1",
            "details": "Great point about AI safety!",
            "agent": {"username": "bob"},
        }

        await notif_channel._handle_notification(notif)

        # Skip the inbound message
        bus.inbound.get_nowait()

        # Check outbound owner notification
        assert not bus.outbound.empty()
        out = bus.outbound.get_nowait()
        assert out.channel == "telegram"
        assert "@bob" in out.content
        assert "replied" in out.content

    async def test_no_notification_when_owner_not_configured(
        self, channel: BottomFeedChannel, bus: MessageBus
    ):
        """Default config (no owner_channel) should produce no outbound."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-1",
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })

        await channel._handle_sse_event(post_data)

        # Inbound should have the mention
        assert not bus.inbound.empty()
        bus.inbound.get_nowait()

        # Outbound should be empty — no owner configured
        assert bus.outbound.empty()

    async def test_respects_notify_events_filter(
        self, notif_channel: BottomFeedChannel, bus: MessageBus
    ):
        """Only configured event types trigger notifications."""
        # notify_events is ["mention", "reply"] — "like" should be filtered out
        notif = {
            "id": "n1",
            "type": "like",
            "agent_id": "agent-456",
            "post_id": "post-1",
            "details": "liked your post",
            "agent": {"username": "carol"},
        }

        await notif_channel._handle_notification(notif)

        # Inbound should have the activity
        bus.inbound.get_nowait()

        # Outbound should be empty — "like" not in notify_events
        assert bus.outbound.empty()

    async def test_notification_format_mention(
        self, notif_channel: BottomFeedChannel
    ):
        text = notif_channel._format_notification(
            "mention", "alice", "Hey @testbot what do you think?", "post-123"
        )
        assert "[BottomFeed]" in text
        assert "@alice" in text
        assert "mentioned you" in text
        assert "Hey @testbot" in text
        assert "post-123" in text

    async def test_notification_format_truncates_long_content(
        self, notif_channel: BottomFeedChannel
    ):
        long_content = "x" * 200
        text = notif_channel._format_notification("mention", "alice", long_content, "p1")
        assert "..." in text
        # Content should be truncated to 150 chars
        assert "x" * 151 not in text


class TestDigestMode:
    """Digest mode: accumulate events, flush periodically."""

    @pytest.fixture
    def digest_config(self):
        return BottomFeedConfig(
            enabled=True,
            api_url="https://bottomfeed.test",
            api_key="bf_test_key",
            agent_username="testbot",
            poll_interval=5,
            sse_enabled=False,
            owner_channel="discord",
            owner_chat_id="discord-999",
            notify_events=["mention", "reply"],
            digest_interval=300,  # 5 min digest
        )

    @pytest.fixture
    def digest_channel(self, bus: MessageBus, digest_config: BottomFeedConfig):
        return BottomFeedChannel(digest_config, bus)

    async def test_digest_accumulates_events(
        self, digest_channel: BottomFeedChannel, bus: MessageBus
    ):
        """In digest mode, events go to buffer, not immediately to outbound."""
        await digest_channel._notify_owner("mention", "alice", "Hey!", "p1")
        await digest_channel._notify_owner("reply", "bob", "Nice!", "p2")

        # Nothing should be on the outbound bus yet
        assert bus.outbound.empty()

        # But the buffer should have 2 events
        assert len(digest_channel._digest_buffer) == 2

    async def test_digest_flush_sends_summary(
        self, digest_channel: BottomFeedChannel, bus: MessageBus
    ):
        """Flushing the buffer sends a single summary to the owner."""
        digest_channel._digest_buffer = [
            ("mention", "alice", "Hey @testbot!", "p1"),
            ("mention", "carol", "Yo @testbot!", "p2"),
            ("reply", "bob", "Great post", "p3"),
        ]

        await digest_channel._flush_digest()

        # Should have exactly one outbound message
        assert not bus.outbound.empty()
        out = bus.outbound.get_nowait()
        assert bus.outbound.empty()  # only one

        assert out.channel == "discord"
        assert out.chat_id == "discord-999"
        assert "BottomFeed Activity" in out.content
        assert "2 mentions" in out.content
        assert "@alice" in out.content
        assert "@carol" in out.content
        assert "1 reply" in out.content
        assert "@bob" in out.content

        # Buffer should be cleared
        assert len(digest_channel._digest_buffer) == 0

    async def test_digest_empty_buffer_no_message(
        self, digest_channel: BottomFeedChannel, bus: MessageBus
    ):
        """Flushing an empty buffer should not send anything."""
        await digest_channel._flush_digest()
        assert bus.outbound.empty()

    async def test_stop_flushes_remaining_digest(
        self, digest_channel: BottomFeedChannel, bus: MessageBus
    ):
        """Remaining events should be flushed on shutdown."""
        digest_channel._digest_buffer = [
            ("mention", "alice", "Hey!", "p1"),
        ]

        with patch.object(digest_channel.client, "update_status", new_callable=AsyncMock):
            with patch.object(digest_channel.client, "close", new_callable=AsyncMock):
                await digest_channel.stop()

        # The remaining event should have been flushed
        assert not bus.outbound.empty()
        out = bus.outbound.get_nowait()
        assert "1 mention" in out.content
        assert "@alice" in out.content

    def test_format_digest_groups_by_type(
        self, digest_channel: BottomFeedChannel
    ):
        digest_channel._digest_buffer = [
            ("mention", "alice", "Hey!", "p1"),
            ("mention", "bob", "Yo!", "p2"),
            ("mention", "alice", "Again!", "p3"),  # duplicate sender
            ("reply", "carol", "Nice!", "p4"),
        ]

        text = digest_channel._format_digest()
        assert "BottomFeed Activity" in text
        assert "3 mentions" in text
        assert "@alice" in text
        assert "@bob" in text
        assert "1 reply" in text
        assert "@carol" in text


class TestInboundMessage:
    def test_session_key(self):
        msg = InboundMessage(
            channel="bottomfeed",
            sender_id="a1",
            chat_id="alice",
            content="hi",
        )
        assert msg.session_key == "bottomfeed:alice"

    def test_default_fields(self):
        msg = InboundMessage(
            channel="bottomfeed",
            sender_id="a1",
            chat_id="alice",
            content="hi",
        )
        assert msg.media == []
        assert msg.metadata == {}


class TestCrossDedup:
    """SSE/polling cross-deduplication via _seen_post_ids."""

    async def test_sse_dedup_skips_duplicate_post(self, channel: BottomFeedChannel, bus: MessageBus):
        """Same post seen twice via SSE should only produce one InboundMessage."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-dup",
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })

        await channel._handle_sse_event(post_data)
        await channel._handle_sse_event(post_data)  # duplicate

        assert bus.inbound.qsize() == 1

    async def test_poll_skips_post_seen_by_sse(self, channel: BottomFeedChannel, bus: MessageBus):
        """Notification for a post already seen via SSE should be skipped."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        # SSE sees the post first
        post_data = json.dumps({
            "id": "post-x",
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })
        await channel._handle_sse_event(post_data)

        # Drain the inbound from SSE
        bus.inbound.get_nowait()

        # Now simulate poll loop seeing the same post_id as a notification
        with patch.object(channel.client, "get_notifications", new_callable=AsyncMock) as mock_notif:
            mock_notif.return_value = {
                "notifications": [{
                    "id": "n-x",
                    "type": "mention",
                    "agent_id": "agent-456",
                    "post_id": "post-x",
                    "agent": {"username": "alice"},
                }],
                "has_more": False,
                "cursor": None,
            }

            # Run one iteration of poll logic manually
            result = await channel.client.get_notifications(
                channel._config.agent_username, limit=20, types=["mention", "reply"]
            )
            for notif in result.get("notifications", []):
                notif_id = notif.get("id")
                if notif_id and notif_id not in channel._seen_notifications:
                    channel._seen_notifications[notif_id] = None
                    post_id = notif.get("post_id", "")
                    if post_id and post_id in channel._seen_post_ids:
                        continue
                    await channel._handle_notification(notif)

        # Inbound should still be empty (cross-dedup skipped it)
        assert bus.inbound.empty()

    async def test_seen_post_ids_pruning(self, channel: BottomFeedChannel):
        """Seen post IDs should be pruned when exceeding limit."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        # Fill with many post IDs
        for i in range(_SEEN_MAX + 100):
            channel._seen_post_ids[f"post-{i}"] = None

        # Trigger pruning via a new SSE event
        post_data = json.dumps({
            "id": "post-trigger",
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
        })
        await channel._handle_sse_event(post_data)

        # Should have been pruned
        assert len(channel._seen_post_ids) <= _SEEN_MAX


class TestReplyLoopDetection:
    """Reply loop detection caps interactions per sender within a time window."""

    async def test_allows_up_to_max_exchanges(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        for i in range(_MAX_REPLY_EXCHANGES):
            post_data = json.dumps({
                "id": f"post-loop-{i}",
                "content": "Hey @testbot!",
                "agent_id": "agent-456",
                "author": {"username": "spammer"},
            })
            await channel._handle_sse_event(post_data)

        assert bus.inbound.qsize() == _MAX_REPLY_EXCHANGES

    async def test_blocks_after_max_exchanges(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        for i in range(_MAX_REPLY_EXCHANGES + 3):
            post_data = json.dumps({
                "id": f"post-spam-{i}",
                "content": "Hey @testbot!",
                "agent_id": "agent-456",
                "author": {"username": "spammer"},
            })
            await channel._handle_sse_event(post_data)

        # Only MAX_REPLY_EXCHANGES should have gotten through
        assert bus.inbound.qsize() == _MAX_REPLY_EXCHANGES

    async def test_different_senders_independent(self, channel: BottomFeedChannel, bus: MessageBus):
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        # Alice sends MAX messages
        for i in range(_MAX_REPLY_EXCHANGES):
            post_data = json.dumps({
                "id": f"post-alice-{i}",
                "content": "Hey @testbot!",
                "agent_id": "agent-a",
                "author": {"username": "alice"},
            })
            await channel._handle_sse_event(post_data)

        # Bob should still get through
        post_data = json.dumps({
            "id": "post-bob-1",
            "content": "Hey @testbot!",
            "agent_id": "agent-b",
            "author": {"username": "bob"},
        })
        await channel._handle_sse_event(post_data)

        assert bus.inbound.qsize() == _MAX_REPLY_EXCHANGES + 1

    async def test_tracker_resets_after_window(self, channel: BottomFeedChannel, bus: MessageBus):
        """After the time window expires, sender should be allowed again."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        # Fill tracker with old timestamps
        channel._reply_tracker["alice"] = [time.monotonic() - _REPLY_WINDOW - 10] * _MAX_REPLY_EXCHANGES

        post_data = json.dumps({
            "id": "post-reset-1",
            "content": "Hey @testbot!",
            "agent_id": "agent-a",
            "author": {"username": "alice"},
        })
        await channel._handle_sse_event(post_data)

        # Should be allowed (old entries expired)
        assert bus.inbound.qsize() == 1


class TestOrderedDictDedup:
    """Verify OrderedDict-based FIFO pruning for _seen_notifications."""

    async def test_oldest_notifications_pruned_first(self, channel: BottomFeedChannel):
        """When pruning, oldest (first-inserted) entries should be removed."""
        # Insert notifications in order
        for i in range(_SEEN_MAX + 1):
            channel._seen_notifications[f"n-{i}"] = None

        # Manually trigger pruning (same logic as poll loop)
        from nanobot_bottomfeed.channel import _SEEN_PRUNE
        if len(channel._seen_notifications) > _SEEN_MAX:
            for _ in range(_SEEN_PRUNE):
                channel._seen_notifications.popitem(last=False)

        # First entries should be gone, later entries still present
        assert "n-0" not in channel._seen_notifications
        assert f"n-{_SEEN_MAX}" in channel._seen_notifications


class TestMalformedSSEEvents:
    """SSE events with missing or malformed fields should not crash."""

    async def test_missing_content_field(self, channel: BottomFeedChannel, bus: MessageBus):
        """Post without 'content' should not crash."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-1",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
            # no content field
        })
        await channel._handle_sse_event(post_data)
        # Should not crash, should skip (no mention in empty content)
        assert bus.inbound.empty()

    async def test_missing_id_field(self, channel: BottomFeedChannel, bus: MessageBus):
        """Post without 'id' should still work (id defaults to empty)."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            "author": {"username": "alice"},
            # no id field
        })
        await channel._handle_sse_event(post_data)
        assert not bus.inbound.empty()
        msg = bus.inbound.get_nowait()
        assert msg.metadata["post_id"] == ""

    async def test_missing_author_field(self, channel: BottomFeedChannel, bus: MessageBus):
        """Post without 'author' should use 'unknown' as sender."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-no-author",
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            # no author field
        })
        await channel._handle_sse_event(post_data)
        assert not bus.inbound.empty()
        msg = bus.inbound.get_nowait()
        assert msg.chat_id == "unknown"

    async def test_non_dict_event(self, channel: BottomFeedChannel, bus: MessageBus):
        """Non-dict JSON (e.g. a list) should be gracefully skipped."""
        await channel._handle_sse_event("[1, 2, 3]")
        assert bus.inbound.empty()

    async def test_numeric_event(self, channel: BottomFeedChannel, bus: MessageBus):
        """Numeric JSON should be gracefully skipped."""
        await channel._handle_sse_event("42")
        assert bus.inbound.empty()

    async def test_author_is_string(self, channel: BottomFeedChannel, bus: MessageBus):
        """Author field that's a string (not dict) should fallback to 'unknown'."""
        channel._config.agent_username = "testbot"
        channel._agent_id = "agent-123"

        post_data = json.dumps({
            "id": "post-bad-author",
            "content": "Hey @testbot!",
            "agent_id": "agent-456",
            "author": "alice",  # string instead of dict
        })
        await channel._handle_sse_event(post_data)
        assert not bus.inbound.empty()
        msg = bus.inbound.get_nowait()
        assert msg.chat_id == "unknown"


class TestPollLoopBackoff:
    """Poll loop exponential backoff on consecutive errors."""

    async def test_backoff_increases_on_errors(self, channel: BottomFeedChannel):
        """Verify the poll loop backs off exponentially on errors."""
        channel._running = True
        call_count = 0
        sleep_times: list[float] = []

        async def failing_notifications(*args, **kwargs):
            nonlocal call_count
            call_count += 1
            if call_count >= 3:
                channel._running = False
            raise ConnectionError("Network error")

        original_sleep = asyncio.sleep

        async def mock_sleep(duration):
            sleep_times.append(duration)
            # Don't actually sleep
            return

        with (
            patch.object(channel.client, "get_notifications", side_effect=failing_notifications),
            patch("asyncio.sleep", side_effect=mock_sleep),
        ):
            await channel._poll_loop()

        # Should have exponentially increasing backoff times
        assert len(sleep_times) >= 2
        assert sleep_times[1] > sleep_times[0]


class TestDigestPluralization:
    """Verify digest formatting pluralizes correctly."""

    def test_reply_pluralization(self):
        """'reply' should become 'replies', not 'replys'."""
        config = BottomFeedConfig(
            enabled=True,
            api_url="https://bottomfeed.test",
            api_key="bf_test_key",
            agent_username="testbot",
            poll_interval=5,
            owner_channel="discord",
            owner_chat_id="999",
            digest_interval=300,
        )
        bus = MessageBus()
        ch = BottomFeedChannel(config, bus)
        ch._digest_buffer = [
            ("reply", "alice", "Great post!", "p1"),
            ("reply", "bob", "I agree!", "p2"),
        ]
        text = ch._format_digest()
        assert "replies" in text
        assert "replys" not in text

    def test_mention_pluralization(self):
        config = BottomFeedConfig(
            enabled=True,
            api_url="https://bottomfeed.test",
            api_key="bf_test_key",
            agent_username="testbot",
            poll_interval=5,
            owner_channel="discord",
            owner_chat_id="999",
            digest_interval=300,
        )
        bus = MessageBus()
        ch = BottomFeedChannel(config, bus)
        ch._digest_buffer = [
            ("mention", "alice", "Hey!", "p1"),
            ("mention", "bob", "Yo!", "p2"),
        ]
        text = ch._format_digest()
        assert "2 mentions" in text
