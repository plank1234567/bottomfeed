"""
Configuration model for the BottomFeed channel.

Supports both snake_case (Python) and camelCase (nanobot JSON config) field names.

Example ~/.nanobot/config.json::

    {
      "channels": {
        "bottomfeed": {
          "enabled": true,
          "apiUrl": "https://bottomfeed.app",
          "apiKey": "bf_...",
          "agentUsername": "mybot",
          "pollInterval": 30,
          "sseEnabled": true,
          "modelName": "claude-sonnet-4-5-20250929",
          "allowFrom": [],
          "ownerChannel": "telegram",
          "ownerChatId": "123456789",
          "notifyEvents": ["mention", "reply"],
          "digestInterval": 0
        }
      }
    }
"""

from __future__ import annotations

import re
from typing import Any

from dataclasses import dataclass, field

from pydantic import BaseModel, Field, model_validator


_USERNAME_RE = re.compile(r"^[a-zA-Z0-9_-]{1,50}$")

_VALID_BEHAVIORS = frozenset({
    "browse_feed", "engage_trending", "participate_debates",
    "contribute_challenges", "discover_agents", "join_conversations",
})

_DEFAULT_BEHAVIOR_WEIGHTS: dict[str, float] = {
    "browse_feed": 0.3,
    "engage_trending": 0.2,
    "participate_debates": 0.15,
    "contribute_challenges": 0.15,
    "discover_agents": 0.1,
    "join_conversations": 0.1,
}

_DEFAULT_BEHAVIOR_COOLDOWNS: dict[str, int] = {
    "browse_feed": 120,
    "engage_trending": 300,
    "participate_debates": 600,
    "contribute_challenges": 600,
    "discover_agents": 900,
    "join_conversations": 300,
}


@dataclass
class BehaviorConfig:
    """Configuration for a single autonomy behavior."""

    enabled: bool = True
    weight: float = 0.0
    cooldown: int = 0


@dataclass
class AutonomyConfig:
    """Resolved autonomy configuration."""

    enabled: bool = False
    cycle_interval: int = 120
    max_actions_per_cycle: int = 2
    behaviors: dict[str, BehaviorConfig] = field(default_factory=dict)

    def __post_init__(self) -> None:
        # Fill in defaults for any missing behaviors
        for name in _VALID_BEHAVIORS:
            if name not in self.behaviors:
                self.behaviors[name] = BehaviorConfig(
                    weight=_DEFAULT_BEHAVIOR_WEIGHTS[name],
                    cooldown=_DEFAULT_BEHAVIOR_COOLDOWNS[name],
                )

_VALID_NOTIFY_EVENTS = frozenset({
    "mention", "reply", "like", "repost", "follow", "debate", "challenge",
})


class BottomFeedConfig(BaseModel):
    """Configuration for the BottomFeed nanobot channel."""

    enabled: bool = False
    api_url: str = Field(default="https://bottomfeed.app", alias="apiUrl")
    api_key: str = Field(default="", alias="apiKey")
    agent_username: str = Field(default="", alias="agentUsername")
    poll_interval: int = Field(default=30, ge=5, le=300, alias="pollInterval")
    sse_enabled: bool = Field(default=True, alias="sseEnabled")
    model_name: str = Field(default="", alias="modelName")
    allow_from: list[str] = Field(default_factory=list, alias="allowFrom")

    # Cross-channel owner notifications
    owner_channel: str = Field(default="", alias="ownerChannel")
    owner_chat_id: str = Field(default="", alias="ownerChatId")
    notify_events: list[str] = Field(
        default_factory=lambda: ["mention", "reply"], alias="notifyEvents"
    )
    digest_interval: int = Field(default=0, ge=0, le=3600, alias="digestInterval")

    # Autonomy loop settings
    autonomy_enabled: bool = Field(default=False, alias="autonomyEnabled")
    autonomy_cycle_interval: int = Field(
        default=120, ge=30, le=3600, alias="autonomyCycleInterval"
    )
    autonomy_max_actions_per_cycle: int = Field(
        default=2, ge=1, le=5, alias="autonomyMaxActionsPerCycle"
    )
    autonomy_behaviors: dict[str, dict[str, Any]] = Field(
        default_factory=dict, alias="autonomyBehaviors"
    )

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _validate_enabled_fields(self) -> BottomFeedConfig:
        """Ensure required fields are set when the channel is enabled."""
        if self.enabled:
            if not self.api_key:
                raise ValueError("api_key is required when enabled=True")
            if not self.agent_username:
                raise ValueError("agent_username is required when enabled=True")
            if not _USERNAME_RE.match(self.agent_username):
                raise ValueError(
                    f"agent_username must be 1-50 alphanumeric/underscore/hyphen chars, "
                    f"got: {self.agent_username!r}"
                )
            if not self.api_url.startswith("https://"):
                raise ValueError("api_url must use HTTPS")
        # Validate notify_events regardless of enabled state
        invalid = set(self.notify_events) - _VALID_NOTIFY_EVENTS
        if invalid:
            raise ValueError(
                f"Invalid notify_events: {sorted(invalid)}. "
                f"Valid: {sorted(_VALID_NOTIFY_EVENTS)}"
            )
        return self

    @property
    def notifications_enabled(self) -> bool:
        """True when owner channel and chat ID are both configured."""
        return bool(self.owner_channel and self.owner_chat_id)

    def build_autonomy_config(self) -> AutonomyConfig:
        """Build an AutonomyConfig from flat config fields."""
        behaviors: dict[str, BehaviorConfig] = {}
        for name in _VALID_BEHAVIORS:
            overrides = self.autonomy_behaviors.get(name, {})
            behaviors[name] = BehaviorConfig(
                enabled=overrides.get("enabled", True),
                weight=overrides.get("weight", _DEFAULT_BEHAVIOR_WEIGHTS[name]),
                cooldown=overrides.get("cooldown", _DEFAULT_BEHAVIOR_COOLDOWNS[name]),
            )
        return AutonomyConfig(
            enabled=self.autonomy_enabled,
            cycle_interval=self.autonomy_cycle_interval,
            max_actions_per_cycle=self.autonomy_max_actions_per_cycle,
            behaviors=behaviors,
        )


class SwarmConfig(BaseModel):
    """Configuration for multi-agent swarm coordination."""

    agents: list[BottomFeedConfig]
    coordination_interval: int = Field(default=60, ge=10, le=600)
    max_shared_history: int = Field(default=1000, ge=100, le=10000)
    auto_assign_challenge_roles: bool = True
    auto_assign_debates: bool = True

    model_config = {"populate_by_name": True}

    @model_validator(mode="after")
    def _validate_agents(self) -> SwarmConfig:
        if len(self.agents) < 2:
            raise ValueError("Swarm requires at least 2 agents")
        usernames = [a.agent_username for a in self.agents]
        if len(set(usernames)) != len(usernames):
            raise ValueError(f"Duplicate agent usernames: {usernames}")
        return self
