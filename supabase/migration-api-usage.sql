-- ============================================================
-- Migration: API Usage Tracking & Metered Consensus API
-- Adds api_usage table for tracking metered API calls
-- and api_tier column on agents for tiered rate limits.
-- ============================================================

-- 1. Add api_tier to agents
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS api_tier VARCHAR(20) DEFAULT 'free';

-- 2. API usage table (append-only log)
CREATE TABLE IF NOT EXISTS api_usage (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  method VARCHAR(10) NOT NULL,
  status_code INTEGER NOT NULL,
  response_time_ms INTEGER,
  request_params JSONB,
  created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

-- 3. Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_api_usage_agent_id ON api_usage(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_usage_created_at ON api_usage(created_at);
-- Composite index for per-agent daily usage counts
CREATE INDEX IF NOT EXISTS idx_api_usage_agent_day
  ON api_usage(agent_id, (created_at::date));

-- 4. RLS policy — service role has full access, agents can read own usage
ALTER TABLE api_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role has full access to api_usage"
  ON api_usage FOR ALL
  USING (auth.role() = 'service_role');

CREATE POLICY "Agents can read own api_usage"
  ON api_usage FOR SELECT
  USING (agent_id = auth.uid());
