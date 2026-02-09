"""Tests for BottomFeed nanobot tools (Tool ABC pattern)."""

from unittest.mock import AsyncMock, patch

import pytest

from nanobot_bottomfeed.client import BottomFeedClient
from nanobot_bottomfeed.tools import (
    BfPost,
    BfReply,
    BfLike,
    BfUnlike,
    BfFollow,
    BfUnfollow,
    BfRepost,
    BfBookmark,
    BfReadFeed,
    BfGetPost,
    BfSearch,
    BfTrending,
    BfConversations,
    BfGetProfile,
    BfDebate,
    BfDebateVote,
    BfDebateResults,
    BfChallenge,
    BfHypothesis,
    BfUpdateStatus,
    BfGetActiveDebate,
    BfGetActiveChallenges,
    ALL_TOOL_CLASSES,
    create_tools,
)


@pytest.fixture
def client():
    return BottomFeedClient("https://bf.test", "bf_key")


class TestToolInterface:
    """Verify all tools follow the nanobot Tool ABC contract."""

    def test_all_tools_have_required_properties(self, client: BottomFeedClient):
        for cls in ALL_TOOL_CLASSES:
            tool = cls(client)
            assert isinstance(tool.name, str), f"{cls.__name__} missing name"
            assert len(tool.name) > 0, f"{cls.__name__} has empty name"
            assert isinstance(tool.description, str), f"{cls.__name__} missing description"
            assert isinstance(tool.parameters, dict), f"{cls.__name__} missing parameters"
            assert tool.parameters.get("type") == "object", f"{cls.__name__} parameters not an object schema"

    def test_all_tools_have_unique_names(self, client: BottomFeedClient):
        names = [cls(client).name for cls in ALL_TOOL_CLASSES]
        assert len(names) == len(set(names)), f"Duplicate tool names: {names}"

    def test_all_tools_produce_valid_schema(self, client: BottomFeedClient):
        for cls in ALL_TOOL_CLASSES:
            tool = cls(client)
            schema = tool.to_schema()
            assert schema["type"] == "function"
            assert "function" in schema
            func = schema["function"]
            assert func["name"] == tool.name
            assert func["description"] == tool.description
            assert func["parameters"] == tool.parameters

    def test_create_tools_returns_all(self, client: BottomFeedClient):
        tools = create_tools(client)
        assert len(tools) == len(ALL_TOOL_CLASSES)
        assert len(tools) == 22

    def test_tool_count(self):
        assert len(ALL_TOOL_CLASSES) == 22


class TestBfPost:
    async def test_success(self, client: BottomFeedClient):
        tool = BfPost(client)
        with patch.object(client, "create_post", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True, "post_id": "p1"}
            result = await tool.execute(content="Hello world")
            assert "Posted successfully" in result
            assert "p1" in result

    async def test_failure(self, client: BottomFeedClient):
        tool = BfPost(client)
        with patch.object(client, "create_post", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": False, "error": "bad"}
            result = await tool.execute(content="Hello")
            assert "Failed" in result


class TestBfReply:
    async def test_success(self, client: BottomFeedClient):
        tool = BfReply(client)
        with patch.object(client, "create_post", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True, "post_id": "p2"}
            result = await tool.execute(post_id="p1", content="Reply")
            assert "Replied successfully" in result
            mock.assert_called_with("Reply", reply_to_id="p1")


class TestBfLike:
    async def test_success(self, client: BottomFeedClient):
        tool = BfLike(client)
        with patch.object(client, "like_post", new_callable=AsyncMock) as mock:
            mock.return_value = True
            result = await tool.execute(post_id="p1")
            assert result == "Liked!"

    async def test_failure(self, client: BottomFeedClient):
        tool = BfLike(client)
        with patch.object(client, "like_post", new_callable=AsyncMock) as mock:
            mock.return_value = False
            result = await tool.execute(post_id="p1")
            assert "Failed" in result


class TestBfFollow:
    async def test_success_changed(self, client: BottomFeedClient):
        tool = BfFollow(client)
        with patch.object(client, "follow", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True, "changed": True}
            result = await tool.execute(username="alice")
            assert "Now following @alice" in result

    async def test_already_following(self, client: BottomFeedClient):
        tool = BfFollow(client)
        with patch.object(client, "follow", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True, "changed": False}
            result = await tool.execute(username="alice")
            assert "Already following" in result


class TestBfUnfollow:
    async def test_success(self, client: BottomFeedClient):
        tool = BfUnfollow(client)
        with patch.object(client, "unfollow", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True}
            result = await tool.execute(username="alice")
            assert "Unfollowed @alice" in result


class TestBfRepost:
    async def test_success(self, client: BottomFeedClient):
        tool = BfRepost(client)
        with patch.object(client, "repost", new_callable=AsyncMock) as mock:
            mock.return_value = True
            result = await tool.execute(post_id="p1")
            assert result == "Reposted!"


class TestBfReadFeed:
    async def test_with_posts(self, client: BottomFeedClient):
        tool = BfReadFeed(client)
        with patch.object(client, "get_feed", new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"id": "p1", "content": "Hi", "author": {"username": "a"}, "like_count": 0, "reply_count": 0},
            ]
            result = await tool.execute(limit=5)
            assert "Latest 1 posts" in result
            assert "[@a]" in result

    async def test_empty_feed(self, client: BottomFeedClient):
        tool = BfReadFeed(client)
        with patch.object(client, "get_feed", new_callable=AsyncMock) as mock:
            mock.return_value = []
            result = await tool.execute()
            assert result == "Feed is empty"


class TestBfSearch:
    async def test_with_results(self, client: BottomFeedClient):
        tool = BfSearch(client)
        with patch.object(client, "search", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "posts": [{"id": "p1", "content": "AI", "author": {"username": "a"}}],
                "agents": [],
            }
            result = await tool.execute(query="AI")
            assert 'Search results for "AI"' in result
            assert "Posts (1)" in result

    async def test_no_results(self, client: BottomFeedClient):
        tool = BfSearch(client)
        with patch.object(client, "search", new_callable=AsyncMock) as mock:
            mock.return_value = {"posts": [], "agents": []}
            result = await tool.execute(query="nothing")
            assert "No results found" in result


class TestBfGetProfile:
    async def test_found(self, client: BottomFeedClient):
        tool = BfGetProfile(client)
        with patch.object(client, "get_profile", new_callable=AsyncMock) as mock:
            mock.return_value = {"username": "alice", "display_name": "Alice", "bio": "hi"}
            result = await tool.execute(username="alice")
            assert "@alice" in result

    async def test_not_found(self, client: BottomFeedClient):
        tool = BfGetProfile(client)
        with patch.object(client, "get_profile", new_callable=AsyncMock) as mock:
            mock.return_value = None
            result = await tool.execute(username="nobody")
            assert "not found" in result


class TestBfDebate:
    async def test_success(self, client: BottomFeedClient):
        tool = BfDebate(client)
        with patch.object(client, "submit_debate_entry", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True, "entry_id": "e1"}
            result = await tool.execute(debate_id="d1", content="My argument")
            assert "submitted" in result


class TestBfChallenge:
    async def test_success(self, client: BottomFeedClient):
        tool = BfChallenge(client)
        with patch.object(client, "contribute_to_challenge", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True}
            result = await tool.execute(challenge_id="c1", content="x" * 100)
            assert "submitted" in result


class TestBfUpdateStatus:
    async def test_success(self, client: BottomFeedClient):
        tool = BfUpdateStatus(client)
        with patch.object(client, "update_status", new_callable=AsyncMock) as mock:
            mock.return_value = True
            result = await tool.execute(status="thinking", action="Reading papers")
            assert "Status updated to thinking" in result

    async def test_failure(self, client: BottomFeedClient):
        tool = BfUpdateStatus(client)
        with patch.object(client, "update_status", new_callable=AsyncMock) as mock:
            mock.return_value = False
            result = await tool.execute(status="online")
            assert "Failed" in result


class TestBfGetPost:
    async def test_found_with_replies(self, client: BottomFeedClient):
        tool = BfGetPost(client)
        with patch.object(client, "get_post", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "post": {"id": "p1", "content": "Hello", "author": {"username": "alice"}, "like_count": 5, "reply_count": 2},
                "replies": [
                    {"id": "r1", "content": "Reply 1", "author": {"username": "bob"}, "like_count": 0, "reply_count": 0},
                ],
            }
            result = await tool.execute(post_id="p1")
            assert "[@alice]" in result
            assert "Replies (1)" in result
            assert "[@bob]" in result

    async def test_not_found(self, client: BottomFeedClient):
        tool = BfGetPost(client)
        with patch.object(client, "get_post", new_callable=AsyncMock) as mock:
            mock.return_value = None
            result = await tool.execute(post_id="p1")
            assert "not found" in result


class TestBfTrending:
    async def test_with_tags(self, client: BottomFeedClient):
        tool = BfTrending(client)
        with patch.object(client, "get_trending", new_callable=AsyncMock) as mock:
            mock.return_value = [{"name": "AI", "count": 42}, {"name": "ML", "count": 10}]
            result = await tool.execute()
            assert "Trending" in result
            assert "#AI (42 posts)" in result
            assert "#ML (10 posts)" in result

    async def test_empty(self, client: BottomFeedClient):
        tool = BfTrending(client)
        with patch.object(client, "get_trending", new_callable=AsyncMock) as mock:
            mock.return_value = []
            result = await tool.execute()
            assert "No trending" in result


class TestBfConversations:
    async def test_with_conversations(self, client: BottomFeedClient):
        tool = BfConversations(client)
        with patch.object(client, "get_conversations", new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"participants": ["alice", "bob"], "reply_count": 5},
            ]
            result = await tool.execute(limit=5)
            assert "Active conversations" in result
            assert "@alice" in result
            assert "5 replies" in result

    async def test_empty(self, client: BottomFeedClient):
        tool = BfConversations(client)
        with patch.object(client, "get_conversations", new_callable=AsyncMock) as mock:
            mock.return_value = []
            result = await tool.execute()
            assert "No active conversations" in result


class TestBfDebateVote:
    async def test_success(self, client: BottomFeedClient):
        tool = BfDebateVote(client)
        with patch.object(client, "vote_on_debate", new_callable=AsyncMock) as mock:
            mock.return_value = True
            result = await tool.execute(debate_id="d1", entry_id="e1")
            assert "Vote cast" in result

    async def test_failure(self, client: BottomFeedClient):
        tool = BfDebateVote(client)
        with patch.object(client, "vote_on_debate", new_callable=AsyncMock) as mock:
            mock.return_value = False
            result = await tool.execute(debate_id="d1", entry_id="e1")
            assert "Failed" in result


class TestBfDebateResults:
    async def test_with_results(self, client: BottomFeedClient):
        tool = BfDebateResults(client)
        with patch.object(client, "get_debate_results", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "entries": [
                    {"agent": {"username": "alice"}, "vote_count": 10, "vote_percentage": 66.7},
                    {"agent": {"username": "bob"}, "vote_count": 5, "vote_percentage": 33.3},
                ],
                "winner": {"username": "alice"},
            }
            result = await tool.execute(debate_id="d1")
            assert "Debate results" in result
            assert "@alice: 10 votes (66.7%)" in result
            assert "Winner: @alice" in result

    async def test_not_available(self, client: BottomFeedClient):
        tool = BfDebateResults(client)
        with patch.object(client, "get_debate_results", new_callable=AsyncMock) as mock:
            mock.return_value = None
            result = await tool.execute(debate_id="d1")
            assert "not available" in result


class TestBfHypothesis:
    async def test_success(self, client: BottomFeedClient):
        tool = BfHypothesis(client)
        with patch.object(client, "submit_hypothesis", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": True, "hypothesis_id": "h1"}
            result = await tool.execute(challenge_id="c1", content="My hypothesis")
            assert "submitted" in result
            assert "h1" in result

    async def test_failure(self, client: BottomFeedClient):
        tool = BfHypothesis(client)
        with patch.object(client, "submit_hypothesis", new_callable=AsyncMock) as mock:
            mock.return_value = {"success": False, "error": "Too short"}
            result = await tool.execute(challenge_id="c1", content="Short")
            assert "Failed" in result


class TestBfUnlike:
    async def test_success(self, client: BottomFeedClient):
        tool = BfUnlike(client)
        with patch.object(client, "unlike_post", new_callable=AsyncMock) as mock:
            mock.return_value = True
            result = await tool.execute(post_id="p1")
            assert result == "Unliked!"

    async def test_failure(self, client: BottomFeedClient):
        tool = BfUnlike(client)
        with patch.object(client, "unlike_post", new_callable=AsyncMock) as mock:
            mock.return_value = False
            result = await tool.execute(post_id="p1")
            assert "Failed" in result


class TestBfBookmark:
    async def test_success(self, client: BottomFeedClient):
        tool = BfBookmark(client)
        with patch.object(client, "bookmark", new_callable=AsyncMock) as mock:
            mock.return_value = True
            result = await tool.execute(post_id="p1")
            assert result == "Bookmarked!"

    async def test_failure(self, client: BottomFeedClient):
        tool = BfBookmark(client)
        with patch.object(client, "bookmark", new_callable=AsyncMock) as mock:
            mock.return_value = False
            result = await tool.execute(post_id="p1")
            assert "Failed" in result


class TestBfGetActiveDebate:
    async def test_with_debate(self, client: BottomFeedClient):
        tool = BfGetActiveDebate(client)
        with patch.object(client, "get_active_debate", new_callable=AsyncMock) as mock:
            mock.return_value = {
                "id": "d1", "topic": "AI ethics", "status": "open", "entry_count": 5,
            }
            result = await tool.execute()
            assert "Active debate: AI ethics" in result
            assert "id=d1" in result
            assert "entries=5" in result

    async def test_no_debate(self, client: BottomFeedClient):
        tool = BfGetActiveDebate(client)
        with patch.object(client, "get_active_debate", new_callable=AsyncMock) as mock:
            mock.return_value = None
            result = await tool.execute()
            assert "No active debate" in result


class TestBfGetActiveChallenges:
    async def test_with_challenges(self, client: BottomFeedClient):
        tool = BfGetActiveChallenges(client)
        with patch.object(client, "get_active_challenges", new_callable=AsyncMock) as mock:
            mock.return_value = [
                {"id": "c1", "title": "AI Safety", "status": "formation", "participant_count": 3},
                {"id": "c2", "title": "Emergent Behavior", "status": "exploration", "participant_count": 7},
            ]
            result = await tool.execute()
            assert "Active challenges (2)" in result
            assert "[formation] AI Safety" in result
            assert "[exploration] Emergent Behavior" in result
            assert "participants=3" in result

    async def test_no_challenges(self, client: BottomFeedClient):
        tool = BfGetActiveChallenges(client)
        with patch.object(client, "get_active_challenges", new_callable=AsyncMock) as mock:
            mock.return_value = []
            result = await tool.execute()
            assert "No active challenges" in result
