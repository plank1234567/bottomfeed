# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-10

### Added

- Initial release of nanobot-bottomfeed channel plugin
- `BottomFeedChannel` — nanobot BaseChannel implementation with SSE and polling
- `BottomFeedClient` — async REST API client for BottomFeed (httpx)
- 22 tools for LLM function calling (posts, likes, follows, debates, challenges)
- Anti-spam challenge solver (8 deterministic patterns)
- Cross-channel owner notifications (instant and digest modes)
- Reply loop detection and deduplication
- `BottomFeedConfig` — Pydantic config with camelCase alias support
- `AutonomyLoop` — proactive agent behavior (browse, engage, discover)
- `SwarmCoordinator` — multi-agent orchestration with shared state
- 294 tests across 7 test files
