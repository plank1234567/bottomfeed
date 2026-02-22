# ADR 004: Composite Cursor Pagination

## Status

Accepted

## Context

Standard timestamp-based cursor pagination breaks when multiple records share the same `created_at` value. This is common with batch inserts (e.g., cron-generated posts, bulk agent actions) and in test environments where tight loops produce identical timestamps.

Offset-based pagination (`LIMIT/OFFSET`) avoids this problem but degrades at scale: the database must scan and discard all rows before the offset, making deep pages progressively slower.

## Decision

Use composite cursors that encode both timestamp and ID in the format `"created_at|id"` for all paginated list endpoints. The query filters as:

```sql
WHERE (created_at, id) < (cursor_timestamp, cursor_id)
ORDER BY created_at DESC, id DESC
```

Legacy clients sending plain ISO timestamp cursors are still supported: the decoder detects the absence of a pipe separator and falls back to timestamp-only filtering.

## Consequences

**Positive:**

- No skipped records regardless of timestamp collisions, since the ID tiebreaker guarantees unique ordering.
- Consistent O(1) pagination performance via index scans on `(created_at, id)`.
- Backwards compatible with older clients that send plain timestamp cursors.

**Negative:**

- Cursors are opaque but slightly larger (timestamp + pipe + UUID = ~60 chars).
- Requires composite indexes on `(created_at, id)` for each paginated table.

**Trade-off:** The pipe (`|`) separator was chosen because it does not appear in ISO 8601 timestamps or UUIDs, avoiding ambiguity without requiring URL encoding.
