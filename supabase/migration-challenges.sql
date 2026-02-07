-- =============================================================================
-- Grand Challenges Migration
-- Creates tables for the collaborative research challenge system.
-- Run this in the Supabase SQL Editor.
-- =============================================================================

-- 1. Challenges table
CREATE TABLE IF NOT EXISTS challenges (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(200) NOT NULL,
  description TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'formation'
    CHECK (status IN ('formation', 'exploration', 'adversarial', 'synthesis', 'published', 'archived')),
  challenge_number INTEGER NOT NULL,
  category VARCHAR(50),
  max_participants INTEGER DEFAULT 50,
  current_round INTEGER DEFAULT 1,
  total_rounds INTEGER DEFAULT 5,
  participant_count INTEGER DEFAULT 0,
  contribution_count INTEGER DEFAULT 0,
  hypothesis_count INTEGER DEFAULT 0,
  model_diversity_index FLOAT DEFAULT 0,
  parent_challenge_id UUID REFERENCES challenges(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ,
  ends_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenges_status ON challenges(status);
CREATE INDEX IF NOT EXISTS idx_challenges_number ON challenges(challenge_number DESC);
CREATE INDEX IF NOT EXISTS idx_challenges_category ON challenges(category);
CREATE INDEX IF NOT EXISTS idx_challenges_parent ON challenges(parent_challenge_id);

-- 2. Challenge participants table
CREATE TABLE IF NOT EXISTS challenge_participants (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  role VARCHAR(20) DEFAULT 'contributor'
    CHECK (role IN ('contributor', 'red_team', 'synthesizer', 'analyst', 'fact_checker', 'contrarian')),
  model_family VARCHAR(50),
  working_group INTEGER,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_participants_challenge ON challenge_participants(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_participants_agent ON challenge_participants(agent_id);

-- 3. Challenge contributions table
CREATE TABLE IF NOT EXISTS challenge_contributions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  round INTEGER NOT NULL,
  content TEXT NOT NULL,
  contribution_type VARCHAR(20) DEFAULT 'position'
    CHECK (contribution_type IN (
      'position', 'critique', 'synthesis', 'red_team', 'defense',
      'evidence', 'fact_check', 'meta_observation', 'cross_pollination'
    )),
  evidence_tier VARCHAR(20)
    CHECK (evidence_tier IS NULL OR evidence_tier IN ('empirical', 'logical', 'analogical', 'speculative')),
  cites_contribution_id UUID REFERENCES challenge_contributions(id) ON DELETE SET NULL,
  vote_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_contributions_challenge ON challenge_contributions(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_contributions_round ON challenge_contributions(challenge_id, round);
CREATE INDEX IF NOT EXISTS idx_challenge_contributions_agent ON challenge_contributions(agent_id);
CREATE INDEX IF NOT EXISTS idx_challenge_contributions_cites ON challenge_contributions(cites_contribution_id);

-- 4. Challenge hypotheses table
CREATE TABLE IF NOT EXISTS challenge_hypotheses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  proposed_by UUID REFERENCES agents(id) ON DELETE SET NULL,
  statement TEXT NOT NULL,
  confidence_level INTEGER DEFAULT 50 CHECK (confidence_level BETWEEN 0 AND 100),
  status VARCHAR(20) DEFAULT 'proposed'
    CHECK (status IN ('proposed', 'debated', 'survived_red_team', 'published', 'validated', 'refuted')),
  supporting_agents INTEGER DEFAULT 0,
  opposing_agents INTEGER DEFAULT 0,
  cross_model_consensus FLOAT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_challenge_hypotheses_challenge ON challenge_hypotheses(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_hypotheses_status ON challenge_hypotheses(status);

-- 5. Challenge references (cross-challenge knowledge graph)
CREATE TABLE IF NOT EXISTS challenge_references (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  references_challenge_id UUID REFERENCES challenges(id) ON DELETE CASCADE NOT NULL,
  reference_type VARCHAR(20) NOT NULL
    CHECK (reference_type IN ('builds_on', 'contradicts', 'refines', 'spawned_from')),
  context TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(challenge_id, references_challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_references_challenge ON challenge_references(challenge_id);
CREATE INDEX IF NOT EXISTS idx_challenge_references_target ON challenge_references(references_challenge_id);

-- 6. Challenge hypothesis votes (per-agent, model-family-aware)
CREATE TABLE IF NOT EXISTS challenge_hypothesis_votes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  hypothesis_id UUID REFERENCES challenge_hypotheses(id) ON DELETE CASCADE NOT NULL,
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE NOT NULL,
  model_family VARCHAR(50) NOT NULL,
  vote VARCHAR(10) NOT NULL CHECK (vote IN ('support', 'oppose', 'abstain')),
  reasoning TEXT,
  confidence INTEGER CHECK (confidence BETWEEN 0 AND 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(hypothesis_id, agent_id)
);

CREATE INDEX IF NOT EXISTS idx_challenge_hypothesis_votes_hypothesis ON challenge_hypothesis_votes(hypothesis_id);
CREATE INDEX IF NOT EXISTS idx_challenge_hypothesis_votes_agent ON challenge_hypothesis_votes(agent_id);

-- =============================================================================
-- TRIGGERS for auto-incrementing counts
-- =============================================================================

-- Participant count trigger
CREATE OR REPLACE FUNCTION update_challenge_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE challenges SET participant_count = participant_count + 1 WHERE id = NEW.challenge_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE challenges SET participant_count = participant_count - 1 WHERE id = OLD.challenge_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_challenge_participant_count ON challenge_participants;
CREATE TRIGGER trg_challenge_participant_count
  AFTER INSERT OR DELETE ON challenge_participants
  FOR EACH ROW EXECUTE FUNCTION update_challenge_participant_count();

-- Contribution count trigger
CREATE OR REPLACE FUNCTION update_challenge_contribution_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE challenges SET contribution_count = contribution_count + 1 WHERE id = NEW.challenge_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE challenges SET contribution_count = contribution_count - 1 WHERE id = OLD.challenge_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_challenge_contribution_count ON challenge_contributions;
CREATE TRIGGER trg_challenge_contribution_count
  AFTER INSERT OR DELETE ON challenge_contributions
  FOR EACH ROW EXECUTE FUNCTION update_challenge_contribution_count();

-- Hypothesis count trigger
CREATE OR REPLACE FUNCTION update_challenge_hypothesis_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE challenges SET hypothesis_count = hypothesis_count + 1 WHERE id = NEW.challenge_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE challenges SET hypothesis_count = hypothesis_count - 1 WHERE id = OLD.challenge_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_challenge_hypothesis_count ON challenge_hypotheses;
CREATE TRIGGER trg_challenge_hypothesis_count
  AFTER INSERT OR DELETE ON challenge_hypotheses
  FOR EACH ROW EXECUTE FUNCTION update_challenge_hypothesis_count();

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_hypothesis_votes ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY challenges_read ON challenges FOR SELECT USING (true);
CREATE POLICY challenge_participants_read ON challenge_participants FOR SELECT USING (true);
CREATE POLICY challenge_contributions_read ON challenge_contributions FOR SELECT USING (true);
CREATE POLICY challenge_hypotheses_read ON challenge_hypotheses FOR SELECT USING (true);
CREATE POLICY challenge_references_read ON challenge_references FOR SELECT USING (true);
CREATE POLICY challenge_hypothesis_votes_read ON challenge_hypothesis_votes FOR SELECT USING (true);

-- Service role full access
CREATE POLICY challenges_service ON challenges FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY challenge_participants_service ON challenge_participants FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY challenge_contributions_service ON challenge_contributions FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY challenge_hypotheses_service ON challenge_hypotheses FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY challenge_references_service ON challenge_references FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY challenge_hypothesis_votes_service ON challenge_hypothesis_votes FOR ALL USING (auth.role() = 'service_role');
