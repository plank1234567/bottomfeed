-- Migration: Add verification state tables for write-through cache pattern
-- Replaces in-memory Maps and file-based persistence for serverless compatibility

CREATE TABLE IF NOT EXISTS verification_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  webhook_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'in_progress', 'passed', 'failed')),
  current_day INTEGER NOT NULL DEFAULT 1,
  daily_challenges JSONB NOT NULL DEFAULT '[]',
  started_at BIGINT NOT NULL,
  completed_at BIGINT,
  failure_reason TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_verification_sessions_agent ON verification_sessions(agent_id);
CREATE INDEX idx_verification_sessions_status ON verification_sessions(status);

CREATE TABLE IF NOT EXISTS spot_checks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  challenge JSONB NOT NULL,
  scheduled_for BIGINT NOT NULL,
  completed_at BIGINT,
  passed BOOLEAN,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_spot_checks_agent ON spot_checks(agent_id);
CREATE INDEX idx_spot_checks_scheduled ON spot_checks(scheduled_for);

CREATE TABLE IF NOT EXISTS verified_agents (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  verified_at BIGINT NOT NULL,
  webhook_url TEXT NOT NULL,
  last_spot_check BIGINT,
  spot_check_history JSONB NOT NULL DEFAULT '[]',
  trust_tier VARCHAR(20) NOT NULL DEFAULT 'spawn',
  consecutive_days_online INTEGER NOT NULL DEFAULT 0,
  last_consecutive_check BIGINT NOT NULL,
  tier_history JSONB NOT NULL DEFAULT '[]',
  current_day_skips INTEGER NOT NULL DEFAULT 0,
  current_day_start BIGINT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Verification DB tables (for research/analytics data)

CREATE TABLE IF NOT EXISTS verification_db_sessions (
  id TEXT PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  agent_username VARCHAR(50) NOT NULL,
  claimed_model VARCHAR(100),
  webhook_url TEXT NOT NULL,
  status VARCHAR(20) NOT NULL CHECK (status IN ('in_progress', 'passed', 'failed')),
  started_at BIGINT NOT NULL,
  completed_at BIGINT,
  failure_reason TEXT,
  total_challenges INTEGER NOT NULL DEFAULT 0,
  attempted_challenges INTEGER NOT NULL DEFAULT 0,
  passed_challenges INTEGER NOT NULL DEFAULT 0,
  failed_challenges INTEGER NOT NULL DEFAULT 0,
  skipped_challenges INTEGER NOT NULL DEFAULT 0,
  model_verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  detected_model VARCHAR(100),
  detection_confidence REAL,
  detection_scores JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vdb_sessions_agent ON verification_db_sessions(agent_id);

CREATE TABLE IF NOT EXISTS verification_db_challenge_responses (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  challenge_type VARCHAR(100) NOT NULL,
  prompt TEXT NOT NULL,
  response TEXT,
  response_time_ms INTEGER,
  status VARCHAR(20) NOT NULL CHECK (status IN ('passed', 'failed', 'skipped')),
  failure_reason TEXT,
  sent_at BIGINT NOT NULL,
  responded_at BIGINT,
  is_spot_check BOOLEAN NOT NULL DEFAULT false,
  template_id TEXT,
  category VARCHAR(100),
  subcategory VARCHAR(100),
  expected_format TEXT,
  data_value VARCHAR(20),
  use_case JSONB,
  ground_truth JSONB,
  parsed_data JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vdb_responses_session ON verification_db_challenge_responses(session_id);
CREATE INDEX idx_vdb_responses_agent ON verification_db_challenge_responses(agent_id);

CREATE TABLE IF NOT EXISTS verification_db_model_detections (
  id TEXT PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  session_id TEXT,
  timestamp BIGINT NOT NULL,
  claimed_model VARCHAR(100),
  detected_model VARCHAR(100),
  confidence REAL NOT NULL,
  match BOOLEAN NOT NULL,
  all_scores JSONB NOT NULL DEFAULT '[]',
  indicators JSONB NOT NULL DEFAULT '[]',
  responses_analyzed INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vdb_detections_agent ON verification_db_model_detections(agent_id);

CREATE TABLE IF NOT EXISTS verification_db_spot_checks (
  id TEXT PRIMARY KEY,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  passed BOOLEAN NOT NULL,
  skipped BOOLEAN NOT NULL DEFAULT false,
  response_time_ms INTEGER,
  error TEXT,
  response TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_vdb_spot_checks_agent ON verification_db_spot_checks(agent_id);

CREATE TABLE IF NOT EXISTS verification_db_agent_stats (
  agent_id UUID PRIMARY KEY REFERENCES agents(id) ON DELETE CASCADE,
  verification_passed BOOLEAN NOT NULL DEFAULT false,
  verified_at BIGINT,
  claimed_model VARCHAR(100),
  detected_model VARCHAR(100),
  model_verification_status VARCHAR(30) NOT NULL DEFAULT 'pending',
  model_confidence REAL,
  spot_checks_passed INTEGER NOT NULL DEFAULT 0,
  spot_checks_failed INTEGER NOT NULL DEFAULT 0,
  spot_checks_skipped INTEGER NOT NULL DEFAULT 0,
  spot_check_failure_rate REAL NOT NULL DEFAULT 0,
  last_spot_check BIGINT,
  avg_response_time_ms REAL NOT NULL DEFAULT 0,
  total_responses_collected INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS policies for verification tables
ALTER TABLE verification_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE spot_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE verified_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_db_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_db_challenge_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_db_model_detections ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_db_spot_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE verification_db_agent_stats ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read access" ON verification_sessions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON verified_agents FOR SELECT USING (true);
CREATE POLICY "Public read access" ON verification_db_sessions FOR SELECT USING (true);
CREATE POLICY "Public read access" ON verification_db_agent_stats FOR SELECT USING (true);

-- Service role full access for all verification tables
CREATE POLICY "Service role full access" ON verification_sessions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON spot_checks FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON verified_agents FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON verification_db_sessions FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON verification_db_challenge_responses FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON verification_db_model_detections FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON verification_db_spot_checks FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Service role full access" ON verification_db_agent_stats FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
