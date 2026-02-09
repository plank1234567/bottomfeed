"""Tests for the BottomFeed API client."""

import pytest
import httpx
import respx

from nanobot_bottomfeed.client import BottomFeedClient, _MAX_CONTENT_LENGTH, _MAX_QUERY_LENGTH


API_URL = "https://bottomfeed.test"


@pytest.fixture
def client():
    return BottomFeedClient(API_URL, "bf_test_key")


@pytest.fixture(autouse=True)
async def cleanup(client: BottomFeedClient):
    yield
    await client.close()


class TestCreatePost:
    @respx.mock
    async def test_success(self, client: BottomFeedClient):
        # Mock challenge endpoint
        respx.get(f"{API_URL}/api/challenge").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "challengeId": "ch-1",
                        "prompt": "What is 847 * 293?",
                        "expiresIn": 30,
                        "instructions": 'Include nonce "a1b2c3d4e5f6a7b8" in metadata.',
                    },
                },
            )
        )

        # Mock post creation
        respx.post(f"{API_URL}/api/posts").mock(
            return_value=httpx.Response(
                201,
                json={
                    "success": True,
                    "data": {"post": {"id": "post-123", "content": "Hello!", "agent_id": "a1", "created_at": "2026-01-01"}},
                },
            )
        )

        result = await client.create_post("Hello!")
        assert result["success"] is True
        assert result["post_id"] == "post-123"

    @respx.mock
    async def test_challenge_failure(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/challenge").mock(
            return_value=httpx.Response(
                500,
                json={"success": False, "error": {"code": "INTERNAL_ERROR", "message": "Server error"}},
            )
        )

        result = await client.create_post("Hello!")
        assert result["success"] is False

    @respx.mock
    async def test_unknown_challenge(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/challenge").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "challengeId": "ch-1",
                        "prompt": "Unknown puzzle format",
                        "expiresIn": 30,
                        "instructions": 'Nonce "a1b2c3d4e5f6a7b8"',
                    },
                },
            )
        )

        result = await client.create_post("Hello!")
        assert result["success"] is False
        assert "Unknown challenge" in result["error"]


class TestGetFeed:
    @respx.mock
    async def test_success(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "posts": [
                            {"id": "p1", "content": "Post 1", "agent_id": "a1"},
                            {"id": "p2", "content": "Post 2", "agent_id": "a2"},
                        ]
                    },
                },
            )
        )

        posts = await client.get_feed(limit=10)
        assert len(posts) == 2
        assert posts[0]["id"] == "p1"

    @respx.mock
    async def test_empty(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"posts": []}})
        )

        posts = await client.get_feed()
        assert posts == []


class TestEngagement:
    @respx.mock
    async def test_like_post(self, client: BottomFeedClient):
        respx.post(f"{API_URL}/api/posts/post-1/like").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"liked": True}})
        )
        assert await client.like_post("post-1") is True

    @respx.mock
    async def test_repost(self, client: BottomFeedClient):
        respx.post(f"{API_URL}/api/posts/post-1/repost").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"reposted": True}})
        )
        assert await client.repost("post-1") is True

    @respx.mock
    async def test_bookmark(self, client: BottomFeedClient):
        respx.post(f"{API_URL}/api/posts/post-1/bookmark").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"bookmarked": True}})
        )
        assert await client.bookmark("post-1") is True


class TestFollow:
    @respx.mock
    async def test_follow(self, client: BottomFeedClient):
        respx.post(f"{API_URL}/api/agents/alice/follow").mock(
            return_value=httpx.Response(
                200, json={"success": True, "data": {"followed": True, "changed": True}}
            )
        )
        result = await client.follow("alice")
        assert result["success"] is True
        assert result["changed"] is True

    @respx.mock
    async def test_unfollow(self, client: BottomFeedClient):
        respx.delete(f"{API_URL}/api/agents/alice/follow").mock(
            return_value=httpx.Response(
                200, json={"success": True, "data": {"unfollowed": True, "changed": True}}
            )
        )
        result = await client.unfollow("alice")
        assert result["success"] is True


class TestRateLimit:
    @respx.mock
    async def test_rate_limit_429(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(
                429,
                headers={"retry-after": "30"},
                json={"success": False, "error": {"code": "RATE_LIMITED", "message": "Too many requests"}},
            )
        )

        posts = await client.get_feed()
        assert posts == []
        assert client.retry_after == 30.0


class TestNotifications:
    @respx.mock
    async def test_get_notifications(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/agents/testbot/notifications").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "notifications": [
                            {"id": "n1", "type": "mention", "agent_id": "a1", "post_id": "p1"},
                        ],
                        "has_more": False,
                        "cursor": None,
                    },
                },
            )
        )

        result = await client.get_notifications("testbot")
        assert len(result["notifications"]) == 1
        assert result["has_more"] is False


class TestSearch:
    @respx.mock
    async def test_search(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/search").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "posts": [{"id": "p1", "content": "AI stuff"}],
                        "agents": [],
                        "query": "AI",
                        "has_more": False,
                    },
                },
            )
        )

        result = await client.search("AI")
        assert len(result["posts"]) == 1


class TestProfile:
    @respx.mock
    async def test_get_profile(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/agents/alice").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {"agent": {"id": "a1", "username": "alice", "display_name": "Alice"}},
                },
            )
        )

        profile = await client.get_profile("alice")
        assert profile is not None
        assert profile["username"] == "alice"

    @respx.mock
    async def test_profile_not_found(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/agents/nobody").mock(
            return_value=httpx.Response(
                404,
                json={"success": False, "error": {"code": "NOT_FOUND", "message": "Agent not found"}},
            )
        )

        profile = await client.get_profile("nobody")
        assert profile is None


class TestInputValidation:
    """Test input validation on client methods."""

    async def test_invalid_post_id_raises(self, client: BottomFeedClient):
        with pytest.raises(ValueError, match="Invalid post_id"):
            await client.like_post("../../etc/passwd")

    async def test_invalid_username_raises(self, client: BottomFeedClient):
        with pytest.raises(ValueError, match="Invalid username"):
            await client.follow("bad username!")

    async def test_content_too_long_returns_error(self, client: BottomFeedClient):
        result = await client.create_post("x" * (_MAX_CONTENT_LENGTH + 1))
        assert result["success"] is False
        assert "too long" in result["error"].lower()

    async def test_query_too_long_returns_empty(self, client: BottomFeedClient):
        result = await client.search("x" * (_MAX_QUERY_LENGTH + 1))
        assert result["posts"] == []

    @respx.mock
    async def test_valid_id_passes(self, client: BottomFeedClient):
        """Valid IDs should pass validation and reach the API (not raise ValueError)."""
        respx.get(f"{API_URL}/api/posts/valid-post-123_abc").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"post": {"id": "valid-post-123_abc"}}})
        )
        result = await client.get_post("valid-post-123_abc")
        assert result is not None


class TestRetry:
    """Test retry logic for transient errors."""

    @respx.mock
    async def test_retries_on_500(self, client: BottomFeedClient):
        route = respx.get(f"{API_URL}/api/trending").mock(
            side_effect=[
                httpx.Response(500, json={"error": "server error"}),
                httpx.Response(200, json={"success": True, "data": {"tags": []}}),
            ]
        )
        result = await client.get_trending()
        assert result == []
        assert route.call_count == 2

    @respx.mock
    async def test_does_not_retry_on_400(self, client: BottomFeedClient):
        route = respx.get(f"{API_URL}/api/trending").mock(
            return_value=httpx.Response(400, json={"success": False, "error": {"code": "BAD_REQUEST"}})
        )
        await client.get_trending()
        assert route.call_count == 1


class TestNewMethods:
    """Tests for newly added client methods."""

    @respx.mock
    async def test_get_post(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/posts/p1").mock(
            return_value=httpx.Response(
                200,
                json={
                    "success": True,
                    "data": {
                        "post": {"id": "p1", "content": "Hello"},
                        "replies": [],
                    },
                },
            )
        )
        result = await client.get_post("p1")
        assert result is not None
        assert result["post"]["id"] == "p1"

    @respx.mock
    async def test_get_post_not_found(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/posts/p999").mock(
            return_value=httpx.Response(404, json={"success": False, "error": {"code": "NOT_FOUND"}})
        )
        result = await client.get_post("p999")
        assert result is None

    @respx.mock
    async def test_delete_post(self, client: BottomFeedClient):
        respx.delete(f"{API_URL}/api/posts/p1").mock(
            return_value=httpx.Response(200, json={"success": True})
        )
        assert await client.delete_post("p1") is True

    @respx.mock
    async def test_unlike_post(self, client: BottomFeedClient):
        respx.delete(f"{API_URL}/api/posts/p1/like").mock(
            return_value=httpx.Response(200, json={"success": True})
        )
        assert await client.unlike_post("p1") is True

    @respx.mock
    async def test_unrepost(self, client: BottomFeedClient):
        respx.delete(f"{API_URL}/api/posts/p1/repost").mock(
            return_value=httpx.Response(200, json={"success": True})
        )
        assert await client.unrepost("p1") is True

    @respx.mock
    async def test_get_trending(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/trending").mock(
            return_value=httpx.Response(
                200,
                json={"success": True, "data": {"tags": [{"name": "AI", "count": 42}]}},
            )
        )
        tags = await client.get_trending()
        assert len(tags) == 1
        assert tags[0]["name"] == "AI"

    @respx.mock
    async def test_get_conversations(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/conversations").mock(
            return_value=httpx.Response(
                200,
                json={"success": True, "data": {"conversations": [{"id": "c1"}]}},
            )
        )
        convos = await client.get_conversations()
        assert len(convos) == 1

    @respx.mock
    async def test_get_agents(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/agents").mock(
            return_value=httpx.Response(
                200,
                json={"success": True, "data": {"agents": [{"username": "alice"}]}},
            )
        )
        agents = await client.get_agents()
        assert len(agents) == 1
        assert agents[0]["username"] == "alice"

    @respx.mock
    async def test_get_debate(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/debates/d1").mock(
            return_value=httpx.Response(
                200,
                json={"success": True, "data": {"id": "d1", "topic": "AI ethics"}},
            )
        )
        result = await client.get_debate("d1")
        assert result is not None
        assert result["topic"] == "AI ethics"

    @respx.mock
    async def test_get_debate_results(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/debates/d1/results").mock(
            return_value=httpx.Response(
                200,
                json={"success": True, "data": {"entries": [], "winner": None}},
            )
        )
        result = await client.get_debate_results("d1")
        assert result is not None

    @respx.mock
    async def test_get_challenge(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/challenges/c1").mock(
            return_value=httpx.Response(
                200,
                json={"success": True, "data": {"id": "c1", "title": "Test challenge"}},
            )
        )
        result = await client.get_challenge("c1")
        assert result is not None
        assert result["title"] == "Test challenge"

    @respx.mock
    async def test_submit_hypothesis(self, client: BottomFeedClient):
        respx.post(f"{API_URL}/api/challenges/c1/hypotheses").mock(
            return_value=httpx.Response(
                201,
                json={"success": True, "data": {"id": "h1"}},
            )
        )
        result = await client.submit_hypothesis("c1", "My hypothesis", 0.8)
        assert result["success"] is True
        assert result["hypothesis_id"] == "h1"

    @respx.mock
    async def test_join_challenge(self, client: BottomFeedClient):
        respx.post(f"{API_URL}/api/challenges/c1/join").mock(
            return_value=httpx.Response(200, json={"success": True})
        )
        result = await client.join_challenge("c1")
        assert result["success"] is True

    @respx.mock
    async def test_vote_on_debate(self, client: BottomFeedClient):
        respx.post(f"{API_URL}/api/debates/d1/vote").mock(
            return_value=httpx.Response(200, json={"success": True})
        )
        assert await client.vote_on_debate("d1", "e1") is True

    @respx.mock
    async def test_update_status(self, client: BottomFeedClient):
        respx.put(f"{API_URL}/api/agents/status").mock(
            return_value=httpx.Response(200, json={"success": True})
        )
        assert await client.update_status("thinking", "Reading papers") is True


class TestHealthCheck:
    """Tests for the health_check() method."""

    @respx.mock
    async def test_healthy(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/health").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"posts": []}})
        )
        result = await client.health_check()
        assert result["ok"] is True
        assert result["api_reachable"] is True
        assert result["authenticated"] is True
        assert result["latency_ms"] > 0

    @respx.mock
    async def test_api_unreachable(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/health").mock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        result = await client.health_check()
        assert result["ok"] is False
        assert result["api_reachable"] is False
        assert "unreachable" in result["error"].lower() or "connect" in result["error"].lower()

    @respx.mock
    async def test_auth_failed(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/health").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(
                401,
                json={"success": False, "error": {"code": "UNAUTHORIZED", "message": "Invalid API key"}},
            )
        )
        result = await client.health_check()
        assert result["ok"] is False
        assert result["api_reachable"] is True
        assert result["authenticated"] is False
        assert "auth" in result["error"].lower()

    @respx.mock
    async def test_health_returns_latency(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/health").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"posts": []}})
        )
        result = await client.health_check()
        assert isinstance(result["latency_ms"], float)
        assert result["latency_ms"] >= 0


class TestRetryAfterClamping:
    """Retry-after header should be clamped and safely parsed."""

    @respx.mock
    async def test_clamps_high_retry_after(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(
                429,
                headers={"retry-after": "9999"},
                json={"success": False, "error": {"code": "RATE_LIMITED"}},
            )
        )
        await client.get_feed()
        assert client.retry_after == 300.0  # clamped to max

    @respx.mock
    async def test_invalid_retry_after_defaults(self, client: BottomFeedClient):
        """Non-numeric retry-after (e.g. HTTP-date) should default to 60."""
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(
                429,
                headers={"retry-after": "Wed, 21 Oct 2026 07:28:00 GMT"},
                json={"success": False, "error": {"code": "RATE_LIMITED"}},
            )
        )
        await client.get_feed()
        assert client.retry_after == 60.0

    @respx.mock
    async def test_missing_retry_after_defaults(self, client: BottomFeedClient):
        """No retry-after header should default to 60."""
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(
                429,
                json={"success": False, "error": {"code": "RATE_LIMITED"}},
            )
        )
        await client.get_feed()
        assert client.retry_after == 60.0


class TestContextManager:
    """BottomFeedClient supports async context manager."""

    @respx.mock
    async def test_aenter_aexit(self):
        respx.get(f"{API_URL}/api/health").mock(
            return_value=httpx.Response(200, json={"status": "ok"})
        )
        respx.get(f"{API_URL}/api/feed").mock(
            return_value=httpx.Response(200, json={"success": True, "data": {"posts": []}})
        )

        async with BottomFeedClient(API_URL, "bf_test_key") as client:
            result = await client.health_check()
            assert result["ok"] is True
        # Client should be closed after exiting
        assert client._client is None

    @respx.mock
    async def test_context_manager_closes_on_error(self):
        respx.get(f"{API_URL}/api/health").mock(
            side_effect=httpx.ConnectError("fail")
        )

        try:
            async with BottomFeedClient(API_URL, "bf_test_key") as client:
                await client.health_check()
        except Exception:
            pass
        assert client._client is None


class TestRetryExhaustion:
    """Test behavior when all retries are exhausted."""

    @respx.mock
    async def test_all_retries_fail(self, client: BottomFeedClient):
        """After 3 failed attempts, should return NETWORK_ERROR."""
        route = respx.get(f"{API_URL}/api/trending").mock(
            side_effect=httpx.ConnectError("Connection refused")
        )
        result = await client.get_trending()
        assert result == []
        assert route.call_count == 3  # _MAX_RETRIES

    @respx.mock
    async def test_all_500s_return_last_response(self, client: BottomFeedClient):
        """After 3 500s, should return the last error response."""
        route = respx.get(f"{API_URL}/api/trending").mock(
            return_value=httpx.Response(
                500, json={"success": False, "error": {"code": "INTERNAL_ERROR"}}
            )
        )
        result = await client.get_trending()
        assert result == []  # get_trending returns [] on failure
        assert route.call_count == 3


class TestParallelChallenges:
    """get_active_challenges should fetch formation and exploration in parallel."""

    @respx.mock
    async def test_parallel_fetch(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/challenges").mock(
            side_effect=[
                httpx.Response(200, json={
                    "success": True,
                    "data": {"challenges": [{"id": "c1", "status": "formation"}]},
                }),
                httpx.Response(200, json={
                    "success": True,
                    "data": {"challenges": [{"id": "c2", "status": "exploration"}]},
                }),
            ]
        )
        result = await client.get_active_challenges()
        assert len(result) == 2
        assert result[0]["id"] == "c1"
        assert result[1]["id"] == "c2"


class TestNonJsonResponse:
    """Handle non-JSON responses gracefully."""

    @respx.mock
    async def test_html_response(self, client: BottomFeedClient):
        respx.get(f"{API_URL}/api/trending").mock(
            return_value=httpx.Response(502, text="<html>Bad Gateway</html>")
        )
        result = await client.get_trending()
        assert result == []
