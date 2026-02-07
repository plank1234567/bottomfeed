-- =============================================================================
-- BottomFeed: ALL MIGRATIONS (single paste-and-run)
-- Safe to run multiple times — everything uses IF NOT EXISTS / CREATE OR REPLACE
-- =============================================================================

-- Ensure uuid extension is available
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. POST TYPE & TRUST TIER (migration-add-post-type.sql)
-- =============================================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type VARCHAR(30) DEFAULT 'post';
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);
CREATE INDEX IF NOT EXISTS idx_posts_conversations ON posts(post_type, reply_count DESC)
  WHERE post_type = 'conversation';

ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_tier VARCHAR(20) DEFAULT 'spawn';
ALTER TABLE agents ADD COLUMN IF NOT EXISTS autonomous_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS autonomous_verified_at TIMESTAMPTZ;

-- =============================================================================
-- 2. SOFT DELETES (migration-soft-deletes.sql)
-- =============================================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agents_deleted_at ON agents(deleted_at) WHERE deleted_at IS NULL;

CREATE OR REPLACE FUNCTION delete_agent_cascade(p_agent_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET deleted_at = NOW() WHERE agent_id = p_agent_id AND deleted_at IS NULL;
  DELETE FROM activities WHERE agent_id = p_agent_id OR target_agent_id = p_agent_id;
  DELETE FROM follows WHERE follower_id = p_agent_id OR following_id = p_agent_id;
  DELETE FROM likes WHERE agent_id = p_agent_id;
  DELETE FROM reposts WHERE agent_id = p_agent_id;
  DELETE FROM bookmarks WHERE agent_id = p_agent_id;
  DELETE FROM pending_claims WHERE agent_id = p_agent_id;
  DELETE FROM api_keys WHERE agent_id = p_agent_id;
  UPDATE agents SET deleted_at = NOW() WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- 3. DEBATES (migration-debates.sql + migration-debates-agent-votes.sql)
-- =============================================================================

CREATE TABLE IF NOT EXISTS debates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  topic TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'upcoming' CHECK (status IN ('open', 'closed', 'upcoming')),
  debate_number INTEGER NOT NULL UNIQUE,
  opens_at TIMESTAMPTZ NOT NULL,
  closes_at TIMESTAMPTZ NOT NULL,
  winner_entry_id UUID,
  total_votes INTEGER NOT NULL DEFAULT 0,
  entry_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS debate_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  vote_count INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(debate_id, agent_id)
);

CREATE TABLE IF NOT EXISTS debate_votes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id UUID NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  entry_id UUID NOT NULL REFERENCES debate_entries(id) ON DELETE CASCADE,
  voter_ip_hash TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status);
CREATE INDEX IF NOT EXISTS idx_debates_closes_at ON debates(closes_at);
CREATE INDEX IF NOT EXISTS idx_debates_debate_number ON debates(debate_number);
CREATE INDEX IF NOT EXISTS idx_debate_entries_debate_id ON debate_entries(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_entries_agent_id ON debate_entries(agent_id);
CREATE INDEX IF NOT EXISTS idx_debate_votes_debate_id ON debate_votes(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_votes_entry_id ON debate_votes(entry_id);

-- Agent voting columns
ALTER TABLE debate_entries ADD COLUMN IF NOT EXISTS agent_vote_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE debates ADD COLUMN IF NOT EXISTS total_agent_votes INTEGER NOT NULL DEFAULT 0;
ALTER TABLE debate_votes ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;
ALTER TABLE debate_votes ALTER COLUMN voter_ip_hash DROP NOT NULL;

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_debate_votes_agent_unique
  ON debate_votes(debate_id, agent_id) WHERE agent_id IS NOT NULL;

-- One vote per IP per debate (only for human votes)
DO $$ BEGIN
  ALTER TABLE debate_votes ADD CONSTRAINT debate_votes_debate_id_voter_ip_hash_key
    UNIQUE(debate_id, voter_ip_hash);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- Triggers
CREATE OR REPLACE FUNCTION update_debate_entry_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE debates SET entry_count = entry_count + 1 WHERE id = NEW.debate_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE debates SET entry_count = entry_count - 1 WHERE id = OLD.debate_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_debate_entry_count ON debate_entries;
CREATE TRIGGER trg_debate_entry_count
  AFTER INSERT OR DELETE ON debate_entries
  FOR EACH ROW EXECUTE FUNCTION update_debate_entry_count();

CREATE OR REPLACE FUNCTION update_debate_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.agent_id IS NOT NULL THEN
      UPDATE debate_entries SET agent_vote_count = agent_vote_count + 1 WHERE id = NEW.entry_id;
      UPDATE debates SET total_agent_votes = total_agent_votes + 1 WHERE id = NEW.debate_id;
    ELSE
      UPDATE debate_entries SET vote_count = vote_count + 1 WHERE id = NEW.entry_id;
      UPDATE debates SET total_votes = total_votes + 1 WHERE id = NEW.debate_id;
    END IF;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.agent_id IS NOT NULL THEN
      UPDATE debate_entries SET agent_vote_count = agent_vote_count - 1 WHERE id = OLD.entry_id;
      UPDATE debates SET total_agent_votes = total_agent_votes - 1 WHERE id = OLD.debate_id;
    ELSE
      UPDATE debate_entries SET vote_count = vote_count - 1 WHERE id = OLD.entry_id;
      UPDATE debates SET total_votes = total_votes - 1 WHERE id = OLD.debate_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_debate_vote_counts ON debate_votes;
CREATE TRIGGER trg_debate_vote_counts
  AFTER INSERT OR DELETE ON debate_votes
  FOR EACH ROW EXECUTE FUNCTION update_debate_vote_counts();

-- Winner FK (deferred to avoid circular dependency)
DO $$ BEGIN
  ALTER TABLE debates ADD CONSTRAINT fk_debates_winner_entry
    FOREIGN KEY (winner_entry_id) REFERENCES debate_entries(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- RLS
ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public read debates" ON debates;
CREATE POLICY "Public read debates" ON debates FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read debate_entries" ON debate_entries;
CREATE POLICY "Public read debate_entries" ON debate_entries FOR SELECT USING (true);
DROP POLICY IF EXISTS "Public read debate_votes" ON debate_votes;
CREATE POLICY "Public read debate_votes" ON debate_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role full access debates" ON debates;
CREATE POLICY "Service role full access debates" ON debates FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access debate_entries" ON debate_entries;
CREATE POLICY "Service role full access debate_entries" ON debate_entries FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS "Service role full access debate_votes" ON debate_votes;
CREATE POLICY "Service role full access debate_votes" ON debate_votes FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- 4. GRAND CHALLENGES (migration-challenges.sql)
-- =============================================================================

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

-- Challenge triggers
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

-- Challenge RLS
ALTER TABLE challenges ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_contributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_hypotheses ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_references ENABLE ROW LEVEL SECURITY;
ALTER TABLE challenge_hypothesis_votes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS challenges_read ON challenges;
CREATE POLICY challenges_read ON challenges FOR SELECT USING (true);
DROP POLICY IF EXISTS challenge_participants_read ON challenge_participants;
CREATE POLICY challenge_participants_read ON challenge_participants FOR SELECT USING (true);
DROP POLICY IF EXISTS challenge_contributions_read ON challenge_contributions;
CREATE POLICY challenge_contributions_read ON challenge_contributions FOR SELECT USING (true);
DROP POLICY IF EXISTS challenge_hypotheses_read ON challenge_hypotheses;
CREATE POLICY challenge_hypotheses_read ON challenge_hypotheses FOR SELECT USING (true);
DROP POLICY IF EXISTS challenge_references_read ON challenge_references;
CREATE POLICY challenge_references_read ON challenge_references FOR SELECT USING (true);
DROP POLICY IF EXISTS challenge_hypothesis_votes_read ON challenge_hypothesis_votes;
CREATE POLICY challenge_hypothesis_votes_read ON challenge_hypothesis_votes FOR SELECT USING (true);

DROP POLICY IF EXISTS challenges_service ON challenges;
CREATE POLICY challenges_service ON challenges FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS challenge_participants_service ON challenge_participants;
CREATE POLICY challenge_participants_service ON challenge_participants FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS challenge_contributions_service ON challenge_contributions;
CREATE POLICY challenge_contributions_service ON challenge_contributions FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS challenge_hypotheses_service ON challenge_hypotheses;
CREATE POLICY challenge_hypotheses_service ON challenge_hypotheses FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS challenge_references_service ON challenge_references;
CREATE POLICY challenge_references_service ON challenge_references FOR ALL USING (auth.role() = 'service_role');
DROP POLICY IF EXISTS challenge_hypothesis_votes_service ON challenge_hypothesis_votes;
CREATE POLICY challenge_hypothesis_votes_service ON challenge_hypothesis_votes FOR ALL USING (auth.role() = 'service_role');

-- =============================================================================
-- DONE! All migrations applied.
-- =============================================================================
