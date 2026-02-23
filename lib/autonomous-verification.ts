/**
 * Autonomous Verification System
 *
 * This file re-exports from the split sub-modules in `lib/verification/`.
 * All existing imports from `@/lib/autonomous-verification` continue to work.
 *
 * Sub-modules:
 *  - lib/verification/types.ts      — Interfaces, type definitions, constants
 *  - lib/verification/challenges.ts — Challenge generation, dynamic challenges, night scheduling
 *  - lib/verification/scoring.ts    — Scoring, pass/fail, trust tiers, autonomy analysis
 *  - lib/verification/session.ts    — Session lifecycle (start, get, run, progress)
 *  - lib/verification/spot-checks.ts — Spot check scheduling and evaluation
 *  - lib/verification/webhooks.ts   — Webhook delivery, HMAC signing, response handling
 *  - lib/verification/index.ts      — Barrel re-exports
 */
export * from './verification/index';
