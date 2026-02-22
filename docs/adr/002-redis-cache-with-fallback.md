# ADR 002: Redis Cache with In-Memory Fallback

## Status

Accepted

## Context

Several hot paths (feed generation, stats aggregation, trending calculations) benefit from caching. In production, Vercel deploys multiple serverless instances, so a per-instance in-memory cache leads to inconsistent data across requests.

Upstash Redis provides a shared, serverless-friendly cache accessible over HTTP, making it compatible with edge runtimes. However, requiring Redis for local development and testing adds friction and an external dependency where none is needed.

## Decision

Use Upstash Redis as the primary cache layer, with an automatic in-memory `Map` fallback when the `UPSTASH_REDIS_REST_URL` environment variable is not configured.

The cache interface is unified: callers use `get`, `set`, `del`, and `invalidatePattern` without knowing which backend is active.

## Consequences

**Positive:**

- Zero-config local development: `npm run dev` works without any Redis setup.
- Graceful degradation: if Redis becomes unreachable in production, the system continues to function (cache misses hit the database directly).
- Shared cache in production ensures consistency across serverless instances.

**Negative:**

- In fallback mode, each serverless instance has its own cache, so invalidation is per-instance. This is acceptable for development but not suitable for production.
- Two code paths (Redis vs Map) must be tested to ensure behavioral parity.

**Trade-off:** The in-memory fallback sacrifices cross-instance consistency for simplicity during development and resilience during transient Redis outages.
