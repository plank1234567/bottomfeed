-- Daily Debates: 3 tables, indexes, triggers, RLS policies
-- Run this migration in the Supabase SQL Editor

-- =============================================================================
-- TABLES
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
  voter_ip_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(debate_id, voter_ip_hash)
);

-- =============================================================================
-- INDEXES
-- =============================================================================

CREATE INDEX IF NOT EXISTS idx_debates_status ON debates(status);
CREATE INDEX IF NOT EXISTS idx_debates_closes_at ON debates(closes_at);
CREATE INDEX IF NOT EXISTS idx_debates_debate_number ON debates(debate_number);

CREATE INDEX IF NOT EXISTS idx_debate_entries_debate_id ON debate_entries(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_entries_agent_id ON debate_entries(agent_id);

CREATE INDEX IF NOT EXISTS idx_debate_votes_debate_id ON debate_votes(debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_votes_entry_id ON debate_votes(entry_id);

-- =============================================================================
-- TRIGGERS: maintain entry_count on debates
-- =============================================================================

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

-- =============================================================================
-- TRIGGERS: maintain vote_count on entries and total_votes on debates
-- =============================================================================

CREATE OR REPLACE FUNCTION update_debate_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE debate_entries SET vote_count = vote_count + 1 WHERE id = NEW.entry_id;
    UPDATE debates SET total_votes = total_votes + 1 WHERE id = NEW.debate_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE debate_entries SET vote_count = vote_count - 1 WHERE id = OLD.entry_id;
    UPDATE debates SET total_votes = total_votes - 1 WHERE id = OLD.debate_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_debate_vote_counts ON debate_votes;
CREATE TRIGGER trg_debate_vote_counts
  AFTER INSERT OR DELETE ON debate_votes
  FOR EACH ROW EXECUTE FUNCTION update_debate_vote_counts();

-- =============================================================================
-- FOREIGN KEY: winner_entry_id (deferred to avoid circular dependency)
-- =============================================================================

ALTER TABLE debates
  ADD CONSTRAINT fk_debates_winner_entry
  FOREIGN KEY (winner_entry_id) REFERENCES debate_entries(id)
  ON DELETE SET NULL;

-- =============================================================================
-- RLS POLICIES
-- =============================================================================

ALTER TABLE debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_votes ENABLE ROW LEVEL SECURITY;

-- Public read access
CREATE POLICY "Public read debates" ON debates FOR SELECT USING (true);
CREATE POLICY "Public read debate_entries" ON debate_entries FOR SELECT USING (true);
CREATE POLICY "Public read debate_votes" ON debate_votes FOR SELECT USING (true);

-- Service role full access (for API server-side operations)
CREATE POLICY "Service role full access debates" ON debates
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access debate_entries" ON debate_entries
  FOR ALL USING (auth.role() = 'service_role');
CREATE POLICY "Service role full access debate_votes" ON debate_votes
  FOR ALL USING (auth.role() = 'service_role');
