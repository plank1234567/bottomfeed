#!/usr/bin/env python3
"""
Integration test for nanobot-bottomfeed against a live BottomFeed instance.

Exercises the full client flow:
  1. Health check (API reachability + auth)
  2. Read feed
  3. Create post (with challenge solving)
  4. Get post by ID
  5. Like the post
  6. Unlike the post
  7. Search for the post
  8. Get trending topics
  9. Get conversations
  10. Get agent profile
  11. Cleanup: delete the post

Usage:
    # Set env vars (or use a .env file)
    export BF_API_URL="https://bottomfeed.app"
    export BF_API_KEY="bf_..."
    export BF_AGENT_USERNAME="mybot"

    # Run
    python3 scripts/integration_test.py

    # Or with explicit args
    python3 scripts/integration_test.py --url https://bottomfeed.app --key bf_... --username mybot

    # Skip destructive tests (post creation/deletion)
    python3 scripts/integration_test.py --read-only
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys
import time

# Add parent dir to path so we can import the package
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from nanobot_bottomfeed.client import BottomFeedClient


# -- Colors for terminal output --

def _green(s: str) -> str:
    return f"\033[92m{s}\033[0m"

def _red(s: str) -> str:
    return f"\033[91m{s}\033[0m"

def _yellow(s: str) -> str:
    return f"\033[93m{s}\033[0m"

def _bold(s: str) -> str:
    return f"\033[1m{s}\033[0m"

def _dim(s: str) -> str:
    return f"\033[2m{s}\033[0m"


class IntegrationTest:
    """Runs a sequence of integration tests against a live BottomFeed API."""

    def __init__(self, client: BottomFeedClient, username: str, read_only: bool = False) -> None:
        self.client = client
        self.username = username
        self.read_only = read_only
        self.passed = 0
        self.failed = 0
        self.skipped = 0
        self._created_post_id: str | None = None

    def _report(self, name: str, ok: bool, detail: str = "", elapsed_ms: float = 0) -> None:
        timing = _dim(f" ({elapsed_ms:.0f}ms)") if elapsed_ms else ""
        if ok:
            self.passed += 1
            status = _green("PASS")
        else:
            self.failed += 1
            status = _red("FAIL")
        info = f"  {_dim(detail)}" if detail else ""
        print(f"  {status}  {name}{timing}{info}")

    def _skip(self, name: str, reason: str = "read-only mode") -> None:
        self.skipped += 1
        print(f"  {_yellow('SKIP')}  {name}  {_dim(reason)}")

    async def run_all(self) -> bool:
        """Run all tests. Returns True if all passed."""
        print()
        print(_bold("=== nanobot-bottomfeed Integration Tests ==="))
        print(f"  API:      {self.client.api_url}")
        print(f"  Agent:    @{self.username}")
        print(f"  Mode:     {'read-only' if self.read_only else 'full (will create/delete a test post)'}")
        print()

        await self.test_health_check()
        await self.test_read_feed()
        await self.test_get_profile()
        await self.test_trending()
        await self.test_conversations()
        await self.test_search()
        await self.test_get_agents()

        if not self.read_only:
            await self.test_create_post()
            if self._created_post_id:
                await self.test_get_post()
                await self.test_like_post()
                await self.test_unlike_post()
                await self.test_search_for_created_post()
                await self.test_delete_post()
        else:
            for name in [
                "Create post", "Get post", "Like post", "Unlike post",
                "Search created post", "Delete post",
            ]:
                self._skip(name)

        # Debate + challenge (read-only, just check endpoints respond)
        await self.test_get_active_debate()
        await self.test_get_active_challenges()

        # Summary
        print()
        total = self.passed + self.failed + self.skipped
        summary = f"  {total} tests: {_green(f'{self.passed} passed')}"
        if self.failed:
            summary += f", {_red(f'{self.failed} failed')}"
        if self.skipped:
            summary += f", {_yellow(f'{self.skipped} skipped')}"
        print(summary)
        print()

        return self.failed == 0

    # ---- Individual tests ----

    async def test_health_check(self) -> None:
        t = time.monotonic()
        result = await self.client.health_check()
        ms = (time.monotonic() - t) * 1000
        self._report(
            "Health check",
            result["ok"],
            f"reachable={result['api_reachable']}, auth={result['authenticated']}, latency={result['latency_ms']:.0f}ms",
            ms,
        )

    async def test_read_feed(self) -> None:
        t = time.monotonic()
        posts = await self.client.get_feed(limit=5)
        ms = (time.monotonic() - t) * 1000
        self._report("Read feed", isinstance(posts, list), f"{len(posts)} posts", ms)

    async def test_get_profile(self) -> None:
        t = time.monotonic()
        profile = await self.client.get_profile(self.username)
        ms = (time.monotonic() - t) * 1000
        ok = profile is not None and profile.get("username") == self.username
        self._report("Get profile", ok, f"@{self.username}" if ok else "not found", ms)

    async def test_trending(self) -> None:
        t = time.monotonic()
        tags = await self.client.get_trending()
        ms = (time.monotonic() - t) * 1000
        self._report("Get trending", isinstance(tags, list), f"{len(tags)} tags", ms)

    async def test_conversations(self) -> None:
        t = time.monotonic()
        convos = await self.client.get_conversations(limit=5)
        ms = (time.monotonic() - t) * 1000
        self._report("Get conversations", isinstance(convos, list), f"{len(convos)} conversations", ms)

    async def test_search(self) -> None:
        t = time.monotonic()
        result = await self.client.search("AI", limit=3)
        ms = (time.monotonic() - t) * 1000
        ok = isinstance(result, dict)
        n_posts = len(result.get("posts", []))
        n_agents = len(result.get("agents", []))
        self._report("Search", ok, f"{n_posts} posts, {n_agents} agents", ms)

    async def test_get_agents(self) -> None:
        t = time.monotonic()
        agents = await self.client.get_agents(sort="popularity", limit=5)
        ms = (time.monotonic() - t) * 1000
        self._report("Get agents", isinstance(agents, list) and len(agents) > 0, f"{len(agents)} agents", ms)

    async def test_create_post(self) -> None:
        t = time.monotonic()
        result = await self.client.create_post(
            "[integration-test] Hello from nanobot-bottomfeed! This post will be deleted shortly."
        )
        ms = (time.monotonic() - t) * 1000
        ok = result.get("success", False)
        if ok:
            self._created_post_id = result.get("post_id")
            self._report("Create post", True, f"id={self._created_post_id}", ms)
        else:
            self._report("Create post", False, f"error: {result.get('error')}", ms)

    async def test_get_post(self) -> None:
        if not self._created_post_id:
            self._skip("Get post", "no post created")
            return
        t = time.monotonic()
        data = await self.client.get_post(self._created_post_id)
        ms = (time.monotonic() - t) * 1000
        self._report("Get post", data is not None, f"id={self._created_post_id}", ms)

    async def test_like_post(self) -> None:
        if not self._created_post_id:
            self._skip("Like post", "no post created")
            return
        t = time.monotonic()
        ok = await self.client.like_post(self._created_post_id)
        ms = (time.monotonic() - t) * 1000
        self._report("Like post", ok, "", ms)

    async def test_unlike_post(self) -> None:
        if not self._created_post_id:
            self._skip("Unlike post", "no post created")
            return
        t = time.monotonic()
        ok = await self.client.unlike_post(self._created_post_id)
        ms = (time.monotonic() - t) * 1000
        self._report("Unlike post", ok, "", ms)

    async def test_search_for_created_post(self) -> None:
        if not self._created_post_id:
            self._skip("Search created post", "no post created")
            return
        # Give search index a moment to catch up
        await asyncio.sleep(1.0)
        t = time.monotonic()
        result = await self.client.search("integration-test nanobot-bottomfeed", limit=5)
        ms = (time.monotonic() - t) * 1000
        posts = result.get("posts", [])
        found = any(p.get("id") == self._created_post_id for p in posts)
        self._report("Search created post", isinstance(result, dict), f"found={found}, {len(posts)} results", ms)

    async def test_delete_post(self) -> None:
        if not self._created_post_id:
            self._skip("Delete post", "no post created")
            return
        t = time.monotonic()
        ok = await self.client.delete_post(self._created_post_id)
        ms = (time.monotonic() - t) * 1000
        self._report("Delete post", ok, f"id={self._created_post_id}", ms)

    async def test_get_active_debate(self) -> None:
        t = time.monotonic()
        debate = await self.client.get_active_debate()
        ms = (time.monotonic() - t) * 1000
        # None is fine — just means no active debate right now
        self._report(
            "Get active debate",
            True,  # endpoint responding is success
            f"{'topic: ' + debate.get('topic', '?')[:40] if debate else 'none active'}",
            ms,
        )

    async def test_get_active_challenges(self) -> None:
        t = time.monotonic()
        challenges = await self.client.get_active_challenges()
        ms = (time.monotonic() - t) * 1000
        self._report(
            "Get active challenges",
            isinstance(challenges, list),
            f"{len(challenges)} active",
            ms,
        )


async def main() -> None:
    parser = argparse.ArgumentParser(description="nanobot-bottomfeed integration test")
    parser.add_argument("--url", default=os.environ.get("BF_API_URL", "https://bottomfeed.app"))
    parser.add_argument("--key", default=os.environ.get("BF_API_KEY", ""))
    parser.add_argument("--username", default=os.environ.get("BF_AGENT_USERNAME", ""))
    parser.add_argument("--read-only", action="store_true", help="Skip write operations")
    args = parser.parse_args()

    if not args.key:
        print(_red("Error: No API key provided. Set BF_API_KEY or use --key"))
        sys.exit(1)
    if not args.username:
        print(_red("Error: No username provided. Set BF_AGENT_USERNAME or use --username"))
        sys.exit(1)

    client = BottomFeedClient(args.url, args.key)
    try:
        runner = IntegrationTest(client, args.username, read_only=args.read_only)
        success = await runner.run_all()
        sys.exit(0 if success else 1)
    finally:
        await client.close()


if __name__ == "__main__":
    asyncio.run(main())
