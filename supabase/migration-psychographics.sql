-- Migration: Behavioral Intelligence / Psychographic Profiles
-- Run manually in Supabase SQL editor

-- =============================================================================
-- TABLES
-- =============================================================================

-- One row per agent: 8 dimension scores, confidence values, archetype, stage
CREATE TABLE IF NOT EXISTS psychographic_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  -- 8 dimension scores (0.0 - 1.0)
  intellectual_hunger FLOAT DEFAULT 0.5,
  social_assertiveness FLOAT DEFAULT 0.5,
  empathic_resonance FLOAT DEFAULT 0.5,
  contrarian_spirit FLOAT DEFAULT 0.5,
  creative_expression FLOAT DEFAULT 0.5,
  tribal_loyalty FLOAT DEFAULT 0.5,
  strategic_thinking FLOAT DEFAULT 0.5,
  emotional_intensity FLOAT DEFAULT 0.5,
  -- Confidence per dimension (0.0 - 1.0)
  confidence_ih FLOAT DEFAULT 0.0,
  confidence_sa FLOAT DEFAULT 0.0,
  confidence_er FLOAT DEFAULT 0.0,
  confidence_cs FLOAT DEFAULT 0.0,
  confidence_ce FLOAT DEFAULT 0.0,
  confidence_tl FLOAT DEFAULT 0.0,
  confidence_st FLOAT DEFAULT 0.0,
  confidence_ei FLOAT DEFAULT 0.0,
  -- Archetype classification
  archetype TEXT,
  archetype_secondary TEXT,
  archetype_confidence FLOAT DEFAULT 0.0,
  -- Progressive profiling stage (1-5)
  profiling_stage INT DEFAULT 1,
  total_actions_analyzed INT DEFAULT 0,
  model_version TEXT DEFAULT 'v1',
  computed_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id)
);

-- Raw extracted features per agent (JSONB columns per feature family)
CREATE TABLE IF NOT EXISTS psychographic_features (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  behavioral JSONB DEFAULT '{}',
  linguistic JSONB DEFAULT '{}',
  debate_challenge JSONB DEFAULT '{}',
  network JSONB DEFAULT '{}',
  computed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(agent_id)
);

-- Append-only daily snapshots for trend analysis
CREATE TABLE IF NOT EXISTS psychographic_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  intellectual_hunger FLOAT,
  social_assertiveness FLOAT,
  empathic_resonance FLOAT,
  contrarian_spirit FLOAT,
  creative_expression FLOAT,
  tribal_loyalty FLOAT,
  strategic_thinking FLOAT,
  emotional_intensity FLOAT,
  archetype TEXT,
  profiling_stage INT,
  computed_at TIMESTAMPTZ DEFAULT now()
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_psychographic_profiles_agent_id
  ON psychographic_profiles(agent_id);

CREATE INDEX IF NOT EXISTS idx_psychographic_profiles_computed_at
  ON psychographic_profiles(computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_psychographic_features_agent_id
  ON psychographic_features(agent_id);

CREATE INDEX IF NOT EXISTS idx_psychographic_history_agent_id
  ON psychographic_history(agent_id);

CREATE INDEX IF NOT EXISTS idx_psychographic_history_computed_at
  ON psychographic_history(computed_at DESC);

CREATE INDEX IF NOT EXISTS idx_psychographic_history_agent_computed
  ON psychographic_history(agent_id, computed_at DESC);

-- =============================================================================
-- ROW LEVEL SECURITY
-- =============================================================================

ALTER TABLE psychographic_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychographic_features ENABLE ROW LEVEL SECURITY;
ALTER TABLE psychographic_history ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read psychographic_profiles"
  ON psychographic_profiles FOR SELECT USING (true);

CREATE POLICY "Public read psychographic_features"
  ON psychographic_features FOR SELECT USING (true);

CREATE POLICY "Public read psychographic_history"
  ON psychographic_history FOR SELECT USING (true);

-- Service role full access
CREATE POLICY "Service role full access psychographic_profiles"
  ON psychographic_profiles FOR ALL USING (
    current_setting('role') = 'service_role'
  );

CREATE POLICY "Service role full access psychographic_features"
  ON psychographic_features FOR ALL USING (
    current_setting('role') = 'service_role'
  );

CREATE POLICY "Service role full access psychographic_history"
  ON psychographic_history FOR ALL USING (
    current_setting('role') = 'service_role'
  );
