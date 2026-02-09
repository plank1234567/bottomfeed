"""Tests for multi-agent swarm coordination."""

from __future__ import annotations

import asyncio
from unittest.mock import AsyncMock, patch

import pytest
from pydantic import ValidationError

from nanobot_bottomfeed.channel import MessageBus
from nanobot_bottomfeed.config import BottomFeedConfig, SwarmConfig
from nanobot_bottomfeed.swarm import (
    AgentHandle,
    ChallengeAssignment,
    ChallengeRole,
    DebateAssignment,
    SharedState,
    SwarmCoordinator,
    _ROLE_CYCLE,
)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _agent_cfg(username: str) -> BottomFeedConfig:
    return BottomFeedConfig(
        enabled=True,
        api_key=f"bf_test_{username}",
        agent_username=username,
        api_url="https://bottomfeed.app",
    )


def _swarm_cfg(
    usernames: list[str] | None = None,
    coordination_interval: int = 10,
    **kwargs: object,
) -> SwarmConfig:
    names = usernames or ["alpha", "beta"]
    return SwarmConfig(
        agents=[_agent_cfg(u) for u in names],
        coordination_interval=coordination_interval,
        **kwargs,
    )


# ===========================================================================
# TestSwarmConfig
# ===========================================================================


class TestSwarmConfig:
    def test_valid_config(self):
        cfg = _swarm_cfg()
        assert len(cfg.agents) == 2
        assert cfg.coordination_interval == 10

    def test_min_agents_required(self):
        with pytest.raises(ValidationError, match="at least 2"):
            SwarmConfig(agents=[_agent_cfg("solo")])

    def test_duplicate_usernames_rejected(self):
        with pytest.raises(ValidationError, match="Duplicate"):
            SwarmConfig(agents=[_agent_cfg("same"), _agent_cfg("same")])

    def test_default_coordination_interval(self):
        cfg = SwarmConfig(agents=[_agent_cfg("a"), _agent_cfg("b")])
        assert cfg.coordination_interval == 60

    def test_coordination_interval_bounds(self):
        with pytest.raises(ValidationError):
            SwarmConfig(agents=[_agent_cfg("a"), _agent_cfg("b")], coordination_interval=5)

    def test_max_shared_history_default(self):
        cfg = _swarm_cfg()
        assert cfg.max_shared_history == 1000

    def test_max_shared_history_bounds(self):
        with pytest.raises(ValidationError):
            _swarm_cfg(max_shared_history=50)

    def test_three_agents(self):
        cfg = _swarm_cfg(usernames=["a", "b", "c"])
        assert len(cfg.agents) == 3


# ===========================================================================
# TestSharedState
# ===========================================================================


class TestSharedState:
    async def test_mark_and_check_seen(self):
        state = SharedState()
        await state.mark_seen("p1", "alpha")
        assert await state.has_any_agent_seen("p1") is True

    async def test_unseen_post(self):
        state = SharedState()
        assert await state.has_any_agent_seen("p1") is False

    async def test_multiple_agents_see_same_post(self):
        state = SharedState()
        await state.mark_seen("p1", "alpha")
        await state.mark_seen("p1", "beta")
        assert len(state.seen_posts["p1"]) == 2

    async def test_record_and_check_action(self):
        state = SharedState()
        await state.record_action("alpha", "like", "p1")
        assert await state.has_any_agent_done("like", "p1") is True

    async def test_action_not_done(self):
        state = SharedState()
        assert await state.has_any_agent_done("like", "p1") is False

    async def test_action_different_target(self):
        state = SharedState()
        await state.record_action("alpha", "like", "p1")
        assert await state.has_any_agent_done("like", "p2") is False

    async def test_assign_challenge_role(self):
        state = SharedState()
        await state.assign_challenge_role("c1", "alpha", ChallengeRole.RED_TEAM)
        assignment = await state.get_challenge_assignment("c1")
        assert assignment is not None
        assert assignment.roles["alpha"] == ChallengeRole.RED_TEAM

    async def test_unassigned_agents(self):
        state = SharedState()
        await state.assign_challenge_role("c1", "alpha", ChallengeRole.CONTRIBUTOR)
        unassigned = await state.get_unassigned_agents("c1", ["alpha", "beta", "gamma"])
        assert unassigned == ["beta", "gamma"]

    async def test_all_agents_unassigned_new_challenge(self):
        state = SharedState()
        unassigned = await state.get_unassigned_agents("c-new", ["a", "b"])
        assert unassigned == ["a", "b"]

    async def test_debate_assignment(self):
        state = SharedState()
        await state.assign_debate("d1", "alpha")
        assert await state.is_debate_notified("d1", "alpha") is True
        assert await state.is_debate_notified("d1", "beta") is False

    async def test_prune_seen(self):
        state = SharedState()
        for i in range(100):
            await state.mark_seen(f"p{i}", "alpha")
        await state.prune_seen(max_entries=50)
        assert len(state.seen_posts) <= 50

    async def test_action_history_bounded(self):
        state = SharedState(max_history=10)
        for i in range(20):
            await state.record_action("alpha", "like", f"p{i}")
        assert len(state.agent_actions["alpha"]) == 10


# ===========================================================================
# TestSwarmCoordinator
# ===========================================================================


class TestSwarmCoordinator:
    def test_creates_agent_handles(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        assert "alpha" in swarm.agents
        assert "beta" in swarm.agents
        assert isinstance(swarm.agents["alpha"], AgentHandle)

    def test_usernames_property(self):
        cfg = _swarm_cfg(usernames=["x", "y", "z"])
        swarm = SwarmCoordinator(cfg)
        assert sorted(swarm.usernames) == ["x", "y", "z"]

    @patch("nanobot_bottomfeed.swarm.BottomFeedChannel")
    async def test_start_and_stop(self, MockChannel):
        mock_channel = AsyncMock()
        MockChannel.return_value = mock_channel

        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        # Replace channels with mocks
        for handle in swarm.agents.values():
            handle.channel = mock_channel

        await swarm.start()
        assert swarm._running is True
        assert swarm._coord_task is not None

        await swarm.stop()
        assert swarm._running is False
        assert swarm._coord_task is None

    async def test_inject_message(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        await swarm.inject_message("alpha", "Test message")
        msg = swarm.agents["alpha"].bus.inbound.get_nowait()
        assert msg.content == "Test message"
        assert msg.metadata["swarm"] is True

    async def test_inject_unknown_agent(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        await swarm.inject_message("nonexistent", "Hello")  # Should not raise

    async def test_broadcast(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        await swarm.broadcast("Hello everyone")
        for handle in swarm.agents.values():
            msg = handle.bus.inbound.get_nowait()
            assert msg.content == "Hello everyone"

    async def test_broadcast_metadata(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        await swarm.broadcast("Coord message")
        for handle in swarm.agents.values():
            msg = handle.bus.inbound.get_nowait()
            assert msg.metadata["swarm"] is True
            assert msg.metadata["coordination"] is True

    async def test_stop_when_not_started(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        # Replace channels with async mocks so stop() can await them
        for handle in swarm.agents.values():
            handle.channel = AsyncMock()
        await swarm.stop()  # Should not raise

    async def test_shared_state_accessible(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)
        assert isinstance(swarm.state, SharedState)

    async def test_max_shared_history_passed(self):
        cfg = _swarm_cfg(max_shared_history=500)
        swarm = SwarmCoordinator(cfg)
        assert swarm.state._max_history == 500


# ===========================================================================
# TestChallengeCoordination
# ===========================================================================


class TestChallengeCoordination:
    async def test_assigns_roles_round_robin(self):
        cfg = _swarm_cfg(usernames=["alpha", "beta"])
        swarm = SwarmCoordinator(cfg)

        # Mock client
        mock_client = AsyncMock()
        mock_client.get_active_challenges = AsyncMock(return_value=[
            {"id": "c1", "title": "AI Safety", "status": "formation"},
        ])
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_challenges()

        # Both agents should have roles
        assignment = await swarm.state.get_challenge_assignment("c1")
        assert assignment is not None
        assert "alpha" in assignment.roles
        assert "beta" in assignment.roles
        assert assignment.roles["alpha"] != assignment.roles["beta"]

    async def test_idempotent_assignment(self):
        cfg = _swarm_cfg(usernames=["alpha", "beta"])
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_challenges = AsyncMock(return_value=[
            {"id": "c1", "title": "Test", "status": "exploration"},
        ])
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_challenges()
        await swarm._coordinate_challenges()

        # Messages should only be sent once
        for handle in swarm.agents.values():
            count = handle.bus.inbound.qsize()
            assert count == 1

    async def test_no_challenges(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_challenges = AsyncMock(return_value=[])
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_challenges()

        for handle in swarm.agents.values():
            assert handle.bus.inbound.empty()

    async def test_challenge_message_content(self):
        cfg = _swarm_cfg(usernames=["alpha", "beta"])
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_challenges = AsyncMock(return_value=[
            {"id": "c1", "title": "Climate AI", "status": "formation"},
        ])
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_challenges()
        msg = swarm.agents["alpha"].bus.inbound.get_nowait()
        assert "Climate AI" in msg.content
        assert "c1" in msg.content

    async def test_assigns_all_role_types(self):
        usernames = [f"agent{i}" for i in range(len(_ROLE_CYCLE))]
        cfg = _swarm_cfg(usernames=usernames)
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_challenges = AsyncMock(return_value=[
            {"id": "c1", "title": "Test", "status": "formation"},
        ])
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_challenges()
        assignment = await swarm.state.get_challenge_assignment("c1")
        assert assignment is not None
        assigned_roles = set(assignment.roles.values())
        assert assigned_roles == set(ChallengeRole)

    async def test_skips_challenge_without_id(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_challenges = AsyncMock(return_value=[
            {"title": "No ID"},
        ])
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_challenges()
        for handle in swarm.agents.values():
            assert handle.bus.inbound.empty()


# ===========================================================================
# TestDebateCoordination
# ===========================================================================


class TestDebateCoordination:
    async def test_notifies_all_agents(self):
        cfg = _swarm_cfg(usernames=["alpha", "beta"])
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_debate = AsyncMock(return_value={
            "id": "d1", "topic": "AI Ethics",
        })
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_debates()

        for handle in swarm.agents.values():
            msg = handle.bus.inbound.get_nowait()
            assert "AI Ethics" in msg.content

    async def test_no_active_debate(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_debate = AsyncMock(return_value=None)
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_debates()
        for handle in swarm.agents.values():
            assert handle.bus.inbound.empty()

    async def test_idempotent_notification(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_debate = AsyncMock(return_value={
            "id": "d1", "topic": "Test",
        })
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_debates()
        await swarm._coordinate_debates()

        for handle in swarm.agents.values():
            assert handle.bus.inbound.qsize() == 1

    async def test_debate_without_id_skipped(self):
        cfg = _swarm_cfg()
        swarm = SwarmCoordinator(cfg)

        mock_client = AsyncMock()
        mock_client.get_active_debate = AsyncMock(return_value={
            "topic": "No ID debate",
        })
        for handle in swarm.agents.values():
            handle.client = mock_client

        await swarm._coordinate_debates()
        for handle in swarm.agents.values():
            assert handle.bus.inbound.empty()
