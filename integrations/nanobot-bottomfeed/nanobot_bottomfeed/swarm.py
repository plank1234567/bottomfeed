"""
Multi-agent swarm coordination for BottomFeed.

Manages N agents with shared state and role assignment. The SwarmCoordinator
runs a background coordination loop that discovers new challenges/debates
and injects coordination messages into each agent's message bus.

Example::

    from nanobot_bottomfeed import SwarmCoordinator
    from nanobot_bottomfeed.config import SwarmConfig, BottomFeedConfig

    config = SwarmConfig(agents=[
        BottomFeedConfig(enabled=True, api_key="bf_1", agent_username="alpha"),
        BottomFeedConfig(enabled=True, api_key="bf_2", agent_username="beta"),
    ])
    swarm = SwarmCoordinator(config)
    await swarm.start()
"""

from __future__ import annotations

import asyncio
import enum
import logging
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from .channel import BottomFeedChannel, InboundMessage, MessageBus
from .client import BottomFeedClient
from .config import SwarmConfig

logger = logging.getLogger(__name__)


class ChallengeRole(str, enum.Enum):
    """Roles an agent can take in a Grand Challenge."""

    CONTRIBUTOR = "contributor"
    RED_TEAM = "red_team"
    SYNTHESIZER = "synthesizer"
    ANALYST = "analyst"
    FACT_CHECKER = "fact_checker"
    CONTRARIAN = "contrarian"


_ROLE_CYCLE = list(ChallengeRole)


@dataclass
class ActionRecord:
    """A recorded agent action for coordination."""

    agent: str
    action: str
    target_id: str
    timestamp: float = field(default_factory=time.monotonic)


@dataclass
class ChallengeAssignment:
    """Role assignments for a challenge."""

    challenge_id: str
    roles: dict[str, ChallengeRole] = field(default_factory=dict)  # username -> role


@dataclass
class DebateAssignment:
    """Debate participation tracking."""

    debate_id: str
    participants: set[str] = field(default_factory=set)  # usernames notified


@dataclass
class AgentHandle:
    """Handle to a single agent in the swarm."""

    username: str
    channel: BottomFeedChannel
    bus: MessageBus
    client: BottomFeedClient


class SharedState:
    """Thread-safe in-memory coordination store for the swarm."""

    def __init__(self, max_history: int = 1000) -> None:
        self._lock = asyncio.Lock()
        self._max_history = max_history
        self.seen_posts: dict[str, set[str]] = {}  # post_id -> set of usernames
        self.challenges: dict[str, ChallengeAssignment] = {}
        self.debates: dict[str, DebateAssignment] = {}
        self.agent_actions: dict[str, deque[ActionRecord]] = {}

    async def mark_seen(self, post_id: str, username: str) -> None:
        """Mark a post as seen by a specific agent."""
        async with self._lock:
            self.seen_posts.setdefault(post_id, set()).add(username)

    async def has_any_agent_seen(self, post_id: str) -> bool:
        """Check if any agent in the swarm has seen this post."""
        async with self._lock:
            return post_id in self.seen_posts and len(self.seen_posts[post_id]) > 0

    async def record_action(self, agent: str, action: str, target_id: str) -> None:
        """Record an action performed by an agent."""
        async with self._lock:
            q = self.agent_actions.setdefault(agent, deque(maxlen=self._max_history))
            q.append(ActionRecord(agent=agent, action=action, target_id=target_id))

    async def has_any_agent_done(self, action: str, target_id: str) -> bool:
        """Check if any agent has performed this action on this target."""
        async with self._lock:
            for q in self.agent_actions.values():
                for record in q:
                    if record.action == action and record.target_id == target_id:
                        return True
            return False

    async def assign_challenge_role(
        self, challenge_id: str, username: str, role: ChallengeRole
    ) -> None:
        """Assign a role to an agent for a challenge."""
        async with self._lock:
            assignment = self.challenges.setdefault(
                challenge_id, ChallengeAssignment(challenge_id=challenge_id)
            )
            assignment.roles[username] = role

    async def get_challenge_assignment(self, challenge_id: str) -> ChallengeAssignment | None:
        """Get role assignments for a challenge."""
        async with self._lock:
            return self.challenges.get(challenge_id)

    async def get_unassigned_agents(
        self, challenge_id: str, all_usernames: list[str]
    ) -> list[str]:
        """Return agents not yet assigned to this challenge."""
        async with self._lock:
            assignment = self.challenges.get(challenge_id)
            if assignment is None:
                return list(all_usernames)
            return [u for u in all_usernames if u not in assignment.roles]

    async def assign_debate(self, debate_id: str, username: str) -> None:
        """Mark an agent as notified about a debate."""
        async with self._lock:
            assignment = self.debates.setdefault(
                debate_id, DebateAssignment(debate_id=debate_id)
            )
            assignment.participants.add(username)

    async def is_debate_notified(self, debate_id: str, username: str) -> bool:
        """Check if an agent was already notified about a debate."""
        async with self._lock:
            assignment = self.debates.get(debate_id)
            return assignment is not None and username in assignment.participants

    async def prune_seen(self, max_entries: int = 5000) -> None:
        """Prune the seen_posts dict if it grows too large."""
        async with self._lock:
            if len(self.seen_posts) > max_entries:
                keys = list(self.seen_posts.keys())
                for key in keys[: len(keys) - max_entries]:
                    del self.seen_posts[key]


class SwarmCoordinator:
    """Manages N BottomFeed agents with shared coordination.

    The coordinator:
    1. Creates AgentHandles (channel + bus + client) for each agent config
    2. Runs a background coordination loop that:
       - Discovers new challenges and assigns roles round-robin
       - Discovers new debates and notifies all agents
       - Injects coordination messages into agent buses
    """

    def __init__(self, config: SwarmConfig) -> None:
        self._config = config
        self.state = SharedState(max_history=config.max_shared_history)
        self.agents: dict[str, AgentHandle] = {}
        self._coord_task: asyncio.Task[None] | None = None
        self._running = False
        self._role_index = 0  # Round-robin counter for challenge roles

        # Create agent handles
        for agent_cfg in config.agents:
            bus = MessageBus()
            client = BottomFeedClient(agent_cfg.api_url, agent_cfg.api_key)
            channel = BottomFeedChannel(agent_cfg, bus)
            self.agents[agent_cfg.agent_username] = AgentHandle(
                username=agent_cfg.agent_username,
                channel=channel,
                bus=bus,
                client=client,
            )

    @property
    def usernames(self) -> list[str]:
        return list(self.agents.keys())

    async def start(self) -> None:
        """Start all agent channels and the coordination loop."""
        self._running = True

        # Start all channels
        for handle in self.agents.values():
            await handle.channel.start()

        # Start coordination loop
        self._coord_task = asyncio.create_task(
            self._coordination_loop(), name="bf-swarm-coord"
        )
        logger.info(
            "Swarm started with %d agents: %s",
            len(self.agents),
            ", ".join(self.usernames),
        )

    async def stop(self) -> None:
        """Stop all agent channels and the coordination loop."""
        self._running = False

        if self._coord_task and not self._coord_task.done():
            self._coord_task.cancel()
            try:
                await self._coord_task
            except asyncio.CancelledError:
                pass
        self._coord_task = None

        for handle in self.agents.values():
            await handle.channel.stop()

        logger.info("Swarm stopped")

    async def inject_message(self, username: str, content: str) -> None:
        """Send a coordination message to a specific agent."""
        handle = self.agents.get(username)
        if handle is None:
            logger.warning("inject_message: unknown agent %s", username)
            return
        msg = InboundMessage(
            channel="bottomfeed",
            sender_id="swarm-coordinator",
            chat_id=username,
            content=content,
            metadata={"swarm": True, "coordination": True},
        )
        await handle.bus.publish_inbound(msg)

    async def broadcast(self, content: str) -> None:
        """Send a coordination message to all agents."""
        for username in self.agents:
            await self.inject_message(username, content)

    async def _coordination_loop(self) -> None:
        """Background loop for swarm-level coordination."""
        while self._running:
            try:
                if self._config.auto_assign_challenge_roles:
                    await self._coordinate_challenges()
                if self._config.auto_assign_debates:
                    await self._coordinate_debates()
            except asyncio.CancelledError:
                break
            except Exception as exc:
                logger.warning("Swarm coordination error: %s", exc)
            await asyncio.sleep(self._config.coordination_interval)

    async def _coordinate_challenges(self) -> None:
        """Discover new challenges and assign roles to agents."""
        # Use the first agent's client to discover challenges
        first_handle = next(iter(self.agents.values()))
        challenges = await first_handle.client.get_active_challenges()

        for challenge in challenges:
            c_id = challenge.get("id")
            if not c_id:
                continue

            unassigned = await self.state.get_unassigned_agents(c_id, self.usernames)
            if not unassigned:
                continue

            for username in unassigned:
                role = _ROLE_CYCLE[self._role_index % len(_ROLE_CYCLE)]
                self._role_index += 1
                await self.state.assign_challenge_role(c_id, username, role)

                title = challenge.get("title", "Unknown")
                await self.inject_message(
                    username,
                    f"[Swarm: Challenge Assignment] You've been assigned the role of "
                    f"**{role.value}** for challenge \"{title}\" (id={c_id}). "
                    f"Use bf_challenge to contribute with this perspective.",
                )

    async def _coordinate_debates(self) -> None:
        """Discover new debates and notify all agents."""
        first_handle = next(iter(self.agents.values()))
        debate = await first_handle.client.get_active_debate()

        if not debate:
            return

        d_id = debate.get("id", "")
        if not d_id:
            return

        topic = debate.get("topic", "Unknown topic")

        for username in self.usernames:
            if await self.state.is_debate_notified(d_id, username):
                continue
            await self.state.assign_debate(d_id, username)
            await self.inject_message(
                username,
                f"[Swarm: Debate] Active debate: \"{topic}\" (id={d_id}). "
                f"Use bf_debate to submit your position.",
            )
