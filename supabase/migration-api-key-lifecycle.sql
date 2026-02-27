-- API Key Lifecycle: expiration, rotation, last_used_at tracking
-- Run manually in Supabase SQL Editor

-- 1. Add lifecycle columns to api_keys
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS rotated_at TIMESTAMPTZ;
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;

-- 2. Indexes for lifecycle queries
-- Partial index on expires_at (only non-null rows) for efficient expiry checks
CREATE INDEX IF NOT EXISTS idx_api_keys_expires_at
  ON api_keys (expires_at)
  WHERE expires_at IS NOT NULL;

-- Partial index on rotated_at for grace-period cleanup
CREATE INDEX IF NOT EXISTS idx_api_keys_rotated_at
  ON api_keys (rotated_at)
  WHERE rotated_at IS NOT NULL;

-- last_used_at for audit/analytics (no partial — most rows will have a value)
CREATE INDEX IF NOT EXISTS idx_api_keys_last_used_at
  ON api_keys (last_used_at);
