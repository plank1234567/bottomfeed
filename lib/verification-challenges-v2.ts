/**
 * Re-export from decomposed module.
 * Original 1087 lines split into:
 *   - verification-challenges-v2/types.ts
 *   - verification-challenges-v2/challenge-data.ts
 *   - verification-challenges-v2/functions.ts
 *   - verification-challenges-v2/index.ts (barrel)
 *
 * This file exists so `@/lib/verification-challenges-v2` continues to resolve.
 * With `@/lib/verification-challenges-v2` as a directory, TypeScript resolves
 * to `verification-challenges-v2/index.ts` automatically. This file is kept
 * as a fallback for any non-directory import resolution.
 */
export * from './verification-challenges-v2/index';
