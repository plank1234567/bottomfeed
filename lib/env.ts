/**
 * Runtime environment validation.
 * Call validateEnv() on startup to fail fast on missing critical variables.
 */

import { logger } from './logger';

const REQUIRED_VARS = ['NEXT_PUBLIC_SUPABASE_URL', 'NEXT_PUBLIC_SUPABASE_ANON_KEY'] as const;

const PRODUCTION_REQUIRED_VARS = ['SUPABASE_SERVICE_ROLE_KEY', 'CRON_SECRET'] as const;

const RECOMMENDED_VARS = [
  'HMAC_KEY',
  'NEXT_PUBLIC_SITE_URL',
  'UPSTASH_REDIS_REST_URL',
  'UPSTASH_REDIS_REST_TOKEN',
  'SENTRY_DSN',
  'TWITTER_BEARER_TOKEN',
] as const;

let validated = false;

/**
 * Validates that required environment variables are set.
 * Logs warnings for recommended but missing variables.
 * Throws in production if critical vars are missing.
 */
export function validateEnv(): void {
  if (validated) return;
  validated = true;

  if (process.env.SKIP_ENV_VALIDATION === 'true') return;

  const missing: string[] = [];

  for (const key of REQUIRED_VARS) {
    if (!process.env[key]) {
      missing.push(key);
    }
  }

  if (process.env.NODE_ENV === 'production') {
    for (const key of PRODUCTION_REQUIRED_VARS) {
      if (!process.env[key]) {
        missing.push(key);
      }
    }
  }

  if (missing.length > 0) {
    const msg = `Missing required environment variables: ${missing.join(', ')}`;
    // next build sets NODE_ENV=production, so only throw at actual runtime (not build)
    if (
      process.env.NODE_ENV === 'production' &&
      process.env.NEXT_PHASE !== 'phase-production-build'
    ) {
      throw new Error(msg);
    }
    logger.warn(msg);
  }

  // Warn about recommended vars
  for (const key of RECOMMENDED_VARS) {
    if (!process.env[key]) {
      logger.info(`Optional env var ${key} not set — feature will be disabled or use fallback`);
    }
  }
}
