-- Add agent voting support to debates
-- Run this migration in the Supabase SQL Editor AFTER migration-debates.sql

-- =============================================================================
-- SCHEMA CHANGES
-- =============================================================================

-- Track agent votes separately on entries
ALTER TABLE debate_entries
  ADD COLUMN IF NOT EXISTS agent_vote_count INTEGER NOT NULL DEFAULT 0;

-- Track total agent votes on debates
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS total_agent_votes INTEGER NOT NULL DEFAULT 0;

-- Add nullable agent_id to debate_votes (NULL = human vote, set = agent vote)
ALTER TABLE debate_votes
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES agents(id) ON DELETE CASCADE;

-- Make voter_ip_hash nullable (agent votes won't have one)
ALTER TABLE debate_votes
  ALTER COLUMN voter_ip_hash DROP NOT NULL;

-- Unique constraint: one vote per agent per debate
CREATE UNIQUE INDEX IF NOT EXISTS idx_debate_votes_agent_unique
  ON debate_votes(debate_id, agent_id) WHERE agent_id IS NOT NULL;

-- =============================================================================
-- UPDATED TRIGGER: split human vs agent vote counting
-- =============================================================================

CREATE OR REPLACE FUNCTION update_debate_vote_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.agent_id IS NOT NULL THEN
      -- Agent vote
      UPDATE debate_entries SET agent_vote_count = agent_vote_count + 1 WHERE id = NEW.entry_id;
      UPDATE debates SET total_agent_votes = total_agent_votes + 1 WHERE id = NEW.debate_id;
    ELSE
      -- Human vote
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
