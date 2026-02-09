"""Tests for BottomFeedConfig validation and serialization."""

import pytest
from pydantic import ValidationError

from nanobot_bottomfeed.config import BottomFeedConfig


class TestDefaults:
    """Default config should work and be backward compatible."""

    def test_disabled_by_default(self):
        cfg = BottomFeedConfig()
        assert cfg.enabled is False

    def test_default_values(self):
        cfg = BottomFeedConfig()
        assert cfg.api_url == "https://bottomfeed.app"
        assert cfg.api_key == ""
        assert cfg.agent_username == ""
        assert cfg.poll_interval == 30
        assert cfg.sse_enabled is True
        assert cfg.model_name == ""
        assert cfg.allow_from == []

    def test_default_notification_fields(self):
        cfg = BottomFeedConfig()
        assert cfg.owner_channel == ""
        assert cfg.owner_chat_id == ""
        assert cfg.notify_events == ["mention", "reply"]
        assert cfg.digest_interval == 0

    def test_notifications_disabled_by_default(self):
        cfg = BottomFeedConfig()
        assert cfg.notifications_enabled is False


class TestCamelCaseAliases:
    """Config should accept camelCase keys (from nanobot JSON config)."""

    def test_camelcase_input(self):
        cfg = BottomFeedConfig(
            apiUrl="https://custom.example.com",
            apiKey="bf_test",
            agentUsername="mybot",
            enabled=True,
        )
        assert cfg.api_url == "https://custom.example.com"
        assert cfg.api_key == "bf_test"
        assert cfg.agent_username == "mybot"

    def test_snake_case_input(self):
        cfg = BottomFeedConfig(
            api_url="https://custom.example.com",
            api_key="bf_test",
            agent_username="mybot",
            enabled=True,
        )
        assert cfg.api_url == "https://custom.example.com"
        assert cfg.api_key == "bf_test"
        assert cfg.agent_username == "mybot"

    def test_camelcase_notifications(self):
        cfg = BottomFeedConfig(
            ownerChannel="telegram",
            ownerChatId="12345",
            notifyEvents=["mention", "reply", "debate"],
            digestInterval=300,
        )
        assert cfg.owner_channel == "telegram"
        assert cfg.owner_chat_id == "12345"
        assert cfg.notify_events == ["mention", "reply", "debate"]
        assert cfg.digest_interval == 300


class TestEnabledValidation:
    """When enabled=True, required fields must be present and valid."""

    def test_enabled_requires_api_key(self):
        with pytest.raises(ValidationError, match="api_key is required"):
            BottomFeedConfig(enabled=True, agent_username="mybot")

    def test_enabled_requires_agent_username(self):
        with pytest.raises(ValidationError, match="agent_username is required"):
            BottomFeedConfig(enabled=True, api_key="bf_test")

    def test_enabled_validates_username_format(self):
        with pytest.raises(ValidationError, match="alphanumeric"):
            BottomFeedConfig(
                enabled=True,
                api_key="bf_test",
                agent_username="invalid username!",
            )

    def test_enabled_valid_config(self):
        cfg = BottomFeedConfig(
            enabled=True,
            api_key="bf_test",
            agent_username="my-bot_123",
        )
        assert cfg.enabled is True

    def test_disabled_skips_validation(self):
        # No error when disabled, even with empty required fields
        cfg = BottomFeedConfig(enabled=False)
        assert cfg.api_key == ""
        assert cfg.agent_username == ""


class TestUsernameValidation:
    """Username format validation edge cases."""

    def test_valid_usernames(self):
        for username in ["a", "alice", "alice_bob", "alice-bob", "ABC123", "a" * 50]:
            cfg = BottomFeedConfig(
                enabled=True, api_key="bf_key", agent_username=username
            )
            assert cfg.agent_username == username

    def test_invalid_usernames(self):
        for username in ["", "a b", "alice@bob", "a" * 51, "alice/bob", "alice.bob"]:
            with pytest.raises(ValidationError):
                BottomFeedConfig(
                    enabled=True, api_key="bf_key", agent_username=username
                )


class TestPollInterval:
    """Poll interval bounds validation."""

    def test_min_poll_interval(self):
        cfg = BottomFeedConfig(poll_interval=5)
        assert cfg.poll_interval == 5

    def test_max_poll_interval(self):
        cfg = BottomFeedConfig(poll_interval=300)
        assert cfg.poll_interval == 300

    def test_below_min_raises(self):
        with pytest.raises(ValidationError):
            BottomFeedConfig(poll_interval=4)

    def test_above_max_raises(self):
        with pytest.raises(ValidationError):
            BottomFeedConfig(poll_interval=301)


class TestDigestInterval:
    """Digest interval bounds validation."""

    def test_zero_means_instant(self):
        cfg = BottomFeedConfig(digest_interval=0)
        assert cfg.digest_interval == 0

    def test_max_digest_interval(self):
        cfg = BottomFeedConfig(digest_interval=3600)
        assert cfg.digest_interval == 3600

    def test_negative_raises(self):
        with pytest.raises(ValidationError):
            BottomFeedConfig(digest_interval=-1)

    def test_above_max_raises(self):
        with pytest.raises(ValidationError):
            BottomFeedConfig(digest_interval=3601)


class TestNotificationsEnabled:
    """notifications_enabled property tests."""

    def test_enabled_when_both_set(self):
        cfg = BottomFeedConfig(owner_channel="telegram", owner_chat_id="123")
        assert cfg.notifications_enabled is True

    def test_disabled_when_channel_empty(self):
        cfg = BottomFeedConfig(owner_channel="", owner_chat_id="123")
        assert cfg.notifications_enabled is False

    def test_disabled_when_chat_id_empty(self):
        cfg = BottomFeedConfig(owner_channel="telegram", owner_chat_id="")
        assert cfg.notifications_enabled is False


class TestHttpsValidation:
    """api_url must use HTTPS when enabled."""

    def test_https_required_when_enabled(self):
        with pytest.raises(ValidationError, match="HTTPS"):
            BottomFeedConfig(
                enabled=True,
                api_key="bf_test",
                agent_username="mybot",
                api_url="http://bottomfeed.local",
            )

    def test_https_allowed(self):
        cfg = BottomFeedConfig(
            enabled=True,
            api_key="bf_test",
            agent_username="mybot",
            api_url="https://bottomfeed.app",
        )
        assert cfg.api_url == "https://bottomfeed.app"

    def test_http_allowed_when_disabled(self):
        """HTTP is allowed when channel is disabled (local dev)."""
        cfg = BottomFeedConfig(
            enabled=False,
            api_url="http://localhost:3000",
        )
        assert cfg.api_url == "http://localhost:3000"


class TestNotifyEventsValidation:
    """notify_events must contain only valid event types."""

    def test_valid_events_accepted(self):
        cfg = BottomFeedConfig(
            notify_events=["mention", "reply", "like", "follow", "debate", "challenge", "repost"],
        )
        assert len(cfg.notify_events) == 7

    def test_invalid_event_rejected(self):
        with pytest.raises(ValidationError, match="Invalid notify_events"):
            BottomFeedConfig(notify_events=["mention", "invalid_event"])

    def test_empty_events_accepted(self):
        cfg = BottomFeedConfig(notify_events=[])
        assert cfg.notify_events == []

    def test_default_events_valid(self):
        cfg = BottomFeedConfig()
        assert set(cfg.notify_events) == {"mention", "reply"}
