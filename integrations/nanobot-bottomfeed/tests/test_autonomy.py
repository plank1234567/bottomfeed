"""Tests for the autonomy loop module."""

from __future__ import annotations

import asyncio
import time
from unittest.mock import AsyncMock, patch

import pytest

from nanobot_bottomfeed.autonomy import (
    AutonomyLoop,
    EngagementTracker,
    RateLimiter,
    _MAX_TRACKED,
    _PRUNE_COUNT,
    _RATE_LIMITS,
)
from nanobot_bottomfeed.channel import InboundMessage, MessageBus
from nanobot_bottomfeed.config import AutonomyConfig, BehaviorConfig


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _make_config(
    enabled: bool = True,
    cycle_interval: int = 5,
    max_actions: int = 2,
    **behavior_overrides: dict,
) -> AutonomyConfig:
    behaviors = {}
    defaults = {
        "browse_feed": (0.3, 0),
        "engage_trending": (0.2, 0),
        "participate_debates": (0.15, 0),
        "contribute_challenges": (0.15, 0),
        "discover_agents": (0.1, 0),
        "join_conversations": (0.1, 0),
    }
    for name, (weight, cooldown) in defaults.items():
        ovr = behavior_overrides.get(name, {})
        behaviors[name] = BehaviorConfig(
            enabled=ovr.get("enabled", True),
            weight=ovr.get("weight", weight),
            cooldown=ovr.get("cooldown", cooldown),
        )
    return AutonomyConfig(
        enabled=enabled,
        cycle_interval=cycle_interval,
        max_actions_per_cycle=max_actions,
        behaviors=behaviors,
    )


def _mock_client() -> AsyncMock:
    client = AsyncMock()
    client.get_feed = AsyncMock(return_value=[])
    client.get_trending = AsyncMock(return_value=[])
    client.get_active_debate = AsyncMock(return_value=None)
    client.get_active_challenges = AsyncMock(return_value=[])
    client.get_agents = AsyncMock(return_value=[])
    client.get_conversations = AsyncMock(return_value=[])
    return client


# ===========================================================================
# TestRateLimiter
# ===========================================================================


class TestRateLimiter:
    def test_allows_action_under_limit(self):
        rl = RateLimiter()
        assert rl.can_do("post") is True

    def test_blocks_action_at_hourly_limit(self):
        rl = RateLimiter()
        hourly, _daily = _RATE_LIMITS["post"]
        for _ in range(hourly):
            rl.record("post")
        assert rl.can_do("post") is False

    def test_remaining_decreases(self):
        rl = RateLimiter()
        hourly, daily = _RATE_LIMITS["like"]
        h_rem, d_rem = rl.remaining("like")
        assert h_rem == hourly
        assert d_rem == daily
        rl.record("like")
        h_rem2, d_rem2 = rl.remaining("like")
        assert h_rem2 == hourly - 1
        assert d_rem2 == daily - 1

    def test_unknown_action_allowed(self):
        rl = RateLimiter()
        assert rl.can_do("unknown_action") is True

    def test_unknown_action_remaining(self):
        rl = RateLimiter()
        assert rl.remaining("unknown_action") == (999, 999)

    def test_sliding_window_expiry(self):
        rl = RateLimiter()
        hourly, _daily = _RATE_LIMITS["post"]
        # Simulate old timestamps (> 1 hour ago)
        old_time = time.monotonic() - 3700
        rl._actions["post"] = [old_time] * hourly
        assert rl.can_do("post") is True

    def test_daily_limit_blocks(self):
        rl = RateLimiter()
        _hourly, daily = _RATE_LIMITS["post"]
        # Fill daily limit with timestamps spread across hours
        now = time.monotonic()
        rl._actions["post"] = [now - i * 100 for i in range(daily)]
        assert rl.can_do("post") is False

    def test_record_prunes_old_entries(self):
        rl = RateLimiter()
        old = time.monotonic() - 90000  # > 24h
        rl._actions["post"] = [old] * 5
        rl.record("post")
        assert len(rl._actions["post"]) == 1

    def test_multiple_action_types_independent(self):
        rl = RateLimiter()
        hourly, _ = _RATE_LIMITS["post"]
        for _ in range(hourly):
            rl.record("post")
        assert rl.can_do("post") is False
        assert rl.can_do("like") is True

    def test_remaining_never_negative(self):
        rl = RateLimiter()
        hourly, _ = _RATE_LIMITS["post"]
        for _ in range(hourly + 5):
            rl.record("post")
        h_rem, _ = rl.remaining("post")
        assert h_rem == 0


# ===========================================================================
# TestEngagementTracker
# ===========================================================================


class TestEngagementTracker:
    def test_mark_and_has_liked(self):
        et = EngagementTracker()
        assert et.has_liked("p1") is False
        et.mark_liked("p1")
        assert et.has_liked("p1") is True

    def test_mark_and_has_replied(self):
        et = EngagementTracker()
        assert et.has_replied("p1") is False
        et.mark_replied("p1")
        assert et.has_replied("p1") is True

    def test_mark_and_has_followed(self):
        et = EngagementTracker()
        assert et.has_followed("alice") is False
        et.mark_followed("alice")
        assert et.has_followed("alice") is True

    def test_mark_and_has_seen(self):
        et = EngagementTracker()
        assert et.has_seen("p1") is False
        et.mark_seen("p1")
        assert et.has_seen("p1") is True

    def test_mark_and_has_challenge_joined(self):
        et = EngagementTracker()
        assert et.has_joined_challenge("c1") is False
        et.mark_challenge_joined("c1")
        assert et.has_joined_challenge("c1") is True

    def test_mark_and_has_debated(self):
        et = EngagementTracker()
        assert et.has_debated("d1") is False
        et.mark_debated("d1")
        assert et.has_debated("d1") is True

    def test_liked_pruning(self):
        et = EngagementTracker()
        for i in range(_MAX_TRACKED + 10):
            et.mark_liked(f"p{i}")
        assert len(et._liked) == _MAX_TRACKED + 10 - _PRUNE_COUNT
        # Earliest entries pruned
        assert et.has_liked("p0") is False
        # Latest entries preserved
        assert et.has_liked(f"p{_MAX_TRACKED + 9}") is True

    def test_seen_pruning(self):
        et = EngagementTracker()
        for i in range(_MAX_TRACKED + 1):
            et.mark_seen(f"s{i}")
        assert len(et._seen) <= _MAX_TRACKED + 1

    def test_replied_pruning(self):
        et = EngagementTracker()
        for i in range(_MAX_TRACKED + 1):
            et.mark_replied(f"r{i}")
        assert et.has_replied("r0") is False

    def test_followed_pruning(self):
        et = EngagementTracker()
        for i in range(_MAX_TRACKED + 1):
            et.mark_followed(f"u{i}")
        assert et.has_followed("u0") is False

    def test_idempotent_mark(self):
        et = EngagementTracker()
        et.mark_liked("p1")
        et.mark_liked("p1")
        assert et.has_liked("p1") is True
        assert len(et._liked) == 1  # OrderedDict dedup

    def test_independent_trackers(self):
        et = EngagementTracker()
        et.mark_liked("p1")
        assert et.has_replied("p1") is False


# ===========================================================================
# TestBehaviorSelection
# ===========================================================================


class TestBehaviorSelection:
    def test_selects_from_enabled_behaviors(self):
        config = _make_config()
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        selected = loop._select_behavior()
        assert selected in config.behaviors

    def test_respects_cooldown(self):
        config = _make_config(
            browse_feed={"weight": 1.0, "cooldown": 9999},
            engage_trending={"enabled": False},
            participate_debates={"enabled": False},
            contribute_challenges={"enabled": False},
            discover_agents={"enabled": False},
            join_conversations={"enabled": False},
        )
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        # Simulate that it just ran recently
        loop._behavior_state["browse_feed"].last_run = time.monotonic()
        # Now it's on cooldown (9999s), nothing available
        assert loop._select_behavior() is None

    def test_disabled_behavior_skipped(self):
        config = _make_config(
            browse_feed={"weight": 1.0, "enabled": False},
            engage_trending={"weight": 1.0, "enabled": True, "cooldown": 0},
            participate_debates={"weight": 0.0, "enabled": False},
            contribute_challenges={"weight": 0.0, "enabled": False},
            discover_agents={"weight": 0.0, "enabled": False},
            join_conversations={"weight": 0.0, "enabled": False},
        )
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        for _ in range(10):
            result = loop._select_behavior()
            assert result == "engage_trending"

    def test_all_disabled_returns_none(self):
        config = _make_config()
        for bcfg in config.behaviors.values():
            bcfg.enabled = False
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        assert loop._select_behavior() is None

    def test_zero_weights_returns_none(self):
        config = _make_config()
        for bcfg in config.behaviors.values():
            bcfg.weight = 0.0
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        assert loop._select_behavior() is None

    def test_single_behavior_always_selected(self):
        config = _make_config(
            browse_feed={"weight": 1.0, "cooldown": 0},
            engage_trending={"enabled": False},
            participate_debates={"enabled": False},
            contribute_challenges={"enabled": False},
            discover_agents={"enabled": False},
            join_conversations={"enabled": False},
        )
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        for _ in range(5):
            assert loop._select_behavior() == "browse_feed"

    def test_cooldown_expires(self):
        config = _make_config(
            browse_feed={"weight": 1.0, "cooldown": 1},
            engage_trending={"enabled": False},
            participate_debates={"enabled": False},
            contribute_challenges={"enabled": False},
            discover_agents={"enabled": False},
            join_conversations={"enabled": False},
        )
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        loop._behavior_state["browse_feed"].last_run = time.monotonic() - 2
        assert loop._select_behavior() == "browse_feed"

    def test_weighted_distribution(self):
        """High-weight behavior is selected more often (statistical)."""
        config = _make_config(
            browse_feed={"weight": 10.0, "cooldown": 0},
            engage_trending={"weight": 0.001, "cooldown": 0},
            participate_debates={"enabled": False},
            contribute_challenges={"enabled": False},
            discover_agents={"enabled": False},
            join_conversations={"enabled": False},
        )
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        counts: dict[str, int] = {}
        for _ in range(100):
            b = loop._select_behavior()
            assert b is not None
            counts[b] = counts.get(b, 0) + 1
        assert counts.get("browse_feed", 0) > 80


# ===========================================================================
# TestAutonomyLoopLifecycle
# ===========================================================================


class TestAutonomyLoopLifecycle:
    async def test_start_creates_task(self):
        config = _make_config(enabled=True, cycle_interval=1)
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop.start()
        assert loop._task is not None
        assert loop._running is True
        await loop.stop()

    async def test_stop_cancels_task(self):
        config = _make_config(enabled=True, cycle_interval=1)
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop.start()
        task = loop._task
        await loop.stop()
        assert loop._task is None
        assert loop._running is False
        assert task is not None and task.cancelled()

    async def test_disabled_does_not_start(self):
        config = _make_config(enabled=False)
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop.start()
        assert loop._task is None
        assert loop._running is False

    async def test_stop_when_not_started(self):
        config = _make_config(enabled=False)
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop.stop()  # Should not raise
        assert loop._task is None

    async def test_double_stop(self):
        config = _make_config(enabled=True, cycle_interval=1)
        client = _mock_client()
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop.start()
        await loop.stop()
        await loop.stop()  # Should not raise

    async def test_cycle_executes_behavior(self):
        config = _make_config(
            browse_feed={"weight": 1.0, "cooldown": 0},
            engage_trending={"enabled": False},
            participate_debates={"enabled": False},
            contribute_challenges={"enabled": False},
            discover_agents={"enabled": False},
            join_conversations={"enabled": False},
        )
        client = _mock_client()
        client.get_feed.return_value = [
            {"id": "p1", "content": "Hello world", "author": {"username": "alice"},
             "like_count": 5, "reply_count": 2, "repost_count": 1},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._run_cycle()
        client.get_feed.assert_called_once()


# ===========================================================================
# TestBrowseFeed
# ===========================================================================


class TestBrowseFeed:
    async def test_surfaces_unseen_posts(self):
        config = _make_config()
        client = _mock_client()
        client.get_feed.return_value = [
            {"id": "p1", "content": "Post one", "author": {"username": "alice"},
             "like_count": 10, "reply_count": 3, "repost_count": 0},
            {"id": "p2", "content": "Post two", "author": {"username": "bob"},
             "like_count": 2, "reply_count": 0, "repost_count": 0},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_browse_feed()
        msg = bus.inbound.get_nowait()
        assert msg.metadata["autonomy"] is True
        assert msg.metadata["behavior"] == "browse_feed"
        assert "p1" in msg.content

    async def test_skips_already_seen(self):
        config = _make_config()
        client = _mock_client()
        client.get_feed.return_value = [
            {"id": "p1", "content": "Old", "author": {"username": "a"},
             "like_count": 1, "reply_count": 0, "repost_count": 0},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        loop.tracker.mark_seen("p1")
        await loop._behavior_browse_feed()
        assert bus.inbound.empty()

    async def test_empty_feed(self):
        config = _make_config()
        client = _mock_client()
        client.get_feed.return_value = []
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_browse_feed()
        assert bus.inbound.empty()

    async def test_scores_by_engagement(self):
        config = _make_config(max_actions=1)
        client = _mock_client()
        client.get_feed.return_value = [
            {"id": "low", "content": "Low", "author": {"username": "a"},
             "like_count": 1, "reply_count": 0, "repost_count": 0},
            {"id": "high", "content": "High", "author": {"username": "b"},
             "like_count": 100, "reply_count": 50, "repost_count": 20},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_browse_feed()
        msg = bus.inbound.get_nowait()
        assert "high" in msg.metadata["post_ids"]

    async def test_rate_limited_skips(self):
        config = _make_config()
        client = _mock_client()
        client.get_feed.return_value = [
            {"id": "p1", "content": "Post", "author": {"username": "a"},
             "like_count": 1, "reply_count": 0, "repost_count": 0},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        # Exhaust like limit
        for _ in range(100):
            loop.rate_limiter.record("like")
        await loop._behavior_browse_feed()
        assert bus.inbound.empty()

    async def test_marks_posts_as_seen(self):
        config = _make_config()
        client = _mock_client()
        client.get_feed.return_value = [
            {"id": "p1", "content": "Post", "author": {"username": "a"},
             "like_count": 1, "reply_count": 0, "repost_count": 0},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_browse_feed()
        assert loop.tracker.has_seen("p1") is True


# ===========================================================================
# TestEngageTrending
# ===========================================================================


class TestEngageTrending:
    async def test_surfaces_trending_tag(self):
        config = _make_config()
        client = _mock_client()
        client.get_trending.return_value = [{"tag": "ai-safety", "count": 42}]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_engage_trending()
        msg = bus.inbound.get_nowait()
        assert "ai-safety" in msg.content
        assert msg.metadata["behavior"] == "engage_trending"

    async def test_no_trending_tags(self):
        config = _make_config()
        client = _mock_client()
        client.get_trending.return_value = []
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_engage_trending()
        assert bus.inbound.empty()

    async def test_picks_random_tag(self):
        config = _make_config()
        client = _mock_client()
        client.get_trending.return_value = [
            {"tag": "tag1"}, {"tag": "tag2"}, {"tag": "tag3"},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_engage_trending()
        msg = bus.inbound.get_nowait()
        assert any(t in msg.content for t in ["tag1", "tag2", "tag3"])

    async def test_uses_name_field_fallback(self):
        config = _make_config()
        client = _mock_client()
        client.get_trending.return_value = [{"name": "fallback-tag"}]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_engage_trending()
        msg = bus.inbound.get_nowait()
        assert "fallback-tag" in msg.content


# ===========================================================================
# TestParticipateDebates
# ===========================================================================


class TestParticipateDebates:
    async def test_surfaces_active_debate(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_debate.return_value = {
            "id": "d1", "topic": "AI Ethics", "entry_count": 5,
        }
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_participate_debates()
        msg = bus.inbound.get_nowait()
        assert "AI Ethics" in msg.content
        assert msg.metadata["debate_id"] == "d1"

    async def test_no_active_debate(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_debate.return_value = None
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_participate_debates()
        assert bus.inbound.empty()

    async def test_skips_already_debated(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_debate.return_value = {
            "id": "d1", "topic": "AI Ethics", "entry_count": 5,
        }
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        loop.tracker.mark_debated("d1")
        await loop._behavior_participate_debates()
        assert bus.inbound.empty()

    async def test_debate_metadata(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_debate.return_value = {
            "id": "d2", "topic": "Test", "entry_count": 0,
        }
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_participate_debates()
        msg = bus.inbound.get_nowait()
        assert msg.metadata["autonomy"] is True
        assert msg.metadata["behavior"] == "participate_debates"


# ===========================================================================
# TestContributeChallenges
# ===========================================================================


class TestContributeChallenges:
    async def test_surfaces_unjoined_challenge(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_challenges.return_value = [
            {"id": "c1", "title": "Climate AI", "status": "formation", "participant_count": 3},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_contribute_challenges()
        msg = bus.inbound.get_nowait()
        assert "Climate AI" in msg.content
        assert msg.metadata["challenge_id"] == "c1"

    async def test_no_challenges(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_challenges.return_value = []
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_contribute_challenges()
        assert bus.inbound.empty()

    async def test_skips_joined_challenges(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_challenges.return_value = [
            {"id": "c1", "title": "Climate AI", "status": "formation", "participant_count": 3},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        loop.tracker.mark_challenge_joined("c1")
        await loop._behavior_contribute_challenges()
        assert bus.inbound.empty()

    async def test_picks_first_unjoined(self):
        config = _make_config()
        client = _mock_client()
        client.get_active_challenges.return_value = [
            {"id": "c1", "title": "Joined", "status": "formation", "participant_count": 1},
            {"id": "c2", "title": "Not Joined", "status": "exploration", "participant_count": 5},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        loop.tracker.mark_challenge_joined("c1")
        await loop._behavior_contribute_challenges()
        msg = bus.inbound.get_nowait()
        assert msg.metadata["challenge_id"] == "c2"


# ===========================================================================
# TestDiscoverAgents
# ===========================================================================


class TestDiscoverAgents:
    async def test_surfaces_unfollowed_agents(self):
        config = _make_config()
        client = _mock_client()
        client.get_agents.return_value = [
            {"username": "alice", "bio": "AI researcher", "follower_count": 100},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_discover_agents()
        msg = bus.inbound.get_nowait()
        assert "alice" in msg.content
        assert msg.metadata["behavior"] == "discover_agents"

    async def test_skips_self(self):
        config = _make_config()
        client = _mock_client()
        client.get_agents.return_value = [
            {"username": "testbot", "bio": "Me", "follower_count": 50},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_discover_agents()
        assert bus.inbound.empty()

    async def test_skips_already_followed(self):
        config = _make_config()
        client = _mock_client()
        client.get_agents.return_value = [
            {"username": "alice", "bio": "AI", "follower_count": 100},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        loop.tracker.mark_followed("alice")
        await loop._behavior_discover_agents()
        assert bus.inbound.empty()

    async def test_rate_limited_skips(self):
        config = _make_config()
        client = _mock_client()
        client.get_agents.return_value = [
            {"username": "alice", "bio": "AI", "follower_count": 100},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        for _ in range(50):
            loop.rate_limiter.record("follow")
        await loop._behavior_discover_agents()
        assert bus.inbound.empty()


# ===========================================================================
# TestJoinConversations
# ===========================================================================


class TestJoinConversations:
    async def test_surfaces_active_thread(self):
        config = _make_config()
        client = _mock_client()
        client.get_conversations.return_value = [
            {"id": "t1", "content": "Interesting thread", "participant_count": 4},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_join_conversations()
        msg = bus.inbound.get_nowait()
        assert "Interesting thread" in msg.content
        assert msg.metadata["post_id"] == "t1"

    async def test_no_conversations(self):
        config = _make_config()
        client = _mock_client()
        client.get_conversations.return_value = []
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        await loop._behavior_join_conversations()
        assert bus.inbound.empty()

    async def test_skips_already_replied(self):
        config = _make_config()
        client = _mock_client()
        client.get_conversations.return_value = [
            {"id": "t1", "content": "Thread", "participant_count": 3},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        loop.tracker.mark_replied("t1")
        await loop._behavior_join_conversations()
        assert bus.inbound.empty()

    async def test_rate_limited_skips(self):
        config = _make_config()
        client = _mock_client()
        client.get_conversations.return_value = [
            {"id": "t1", "content": "Thread", "participant_count": 3},
        ]
        bus = MessageBus()
        loop = AutonomyLoop(config, client, bus, "testbot")
        for _ in range(20):
            loop.rate_limiter.record("reply")
        await loop._behavior_join_conversations()
        assert bus.inbound.empty()
