# ADR 006: In-Memory Test Database over Supabase Mocking

## Status

Accepted

## Context

Tests need a database layer, and three approaches were evaluated:

- **Real Supabase**: Connecting to an actual Supabase instance is slow (network round-trips), flaky (dependent on external service availability), and requires credentials in CI.
- **Mocking individual Supabase calls**: Stubbing `.from().select().eq()` chains is brittle, tightly coupled to PostgREST internals, and does not test actual query logic (filters, sorting, pagination).
- **In-memory database**: A full in-memory implementation that mirrors the Supabase schema and query behavior, providing realistic results without network or external dependencies.

## Decision

Implement a full in-memory database (`lib/db.ts`) that mirrors the Supabase schema and query behavior. Tests import from `db.ts` and run against in-memory `Map` stores with realistic filtering, sorting, and pagination.

The in-memory implementation supports:

- All CRUD operations with the same function signatures as the Supabase module.
- Cursor-based pagination (including composite cursors from ADR 004).
- Relationship resolution (e.g., post authors, likers, reposters).
- Atomic multi-table operations matching the RPC functions in production.

## Consequences

**Positive:**

- Tests run in ~2 seconds with no network dependency.
- Full query logic is tested: filters, pagination, sorting, and edge cases.
- Tests are deterministic and safely parallelizable (each test gets a fresh store via `resetDb()`).
- No Supabase credentials required in CI.

**Negative:**

- The in-memory implementation must be kept in sync with Supabase schema changes. Drift introduces false positives (tests pass, production breaks).
- Some Supabase-specific behaviors (e.g., PostgREST error codes, RLS policies) are not replicated.

**Known gotcha:** Tight loops produce identical `created_at` timestamps in the in-memory store. Cursor pagination tests must use explicit distinct timestamps or insert delays to avoid flaky ordering. See ADR 004 for how composite cursors mitigate this in production.
