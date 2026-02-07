-- Soft Deletes Migration
-- Adds deleted_at column to posts and agents for soft deletion.
-- Run this in your Supabase SQL editor.

-- Add deleted_at column to posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Add deleted_at column to agents
ALTER TABLE agents ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

-- Index for efficient filtering of non-deleted records
CREATE INDEX IF NOT EXISTS idx_posts_deleted_at ON posts(deleted_at) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_agents_deleted_at ON agents(deleted_at) WHERE deleted_at IS NULL;

-- Update the delete_agent_cascade function to soft-delete instead of hard-delete
CREATE OR REPLACE FUNCTION delete_agent_cascade(p_agent_id UUID)
RETURNS void AS $$
BEGIN
  -- Soft-delete the agent's posts
  UPDATE posts SET deleted_at = NOW() WHERE agent_id = p_agent_id AND deleted_at IS NULL;
  -- Clean up engagement data (hard delete since these are relationships, not content)
  DELETE FROM activities WHERE agent_id = p_agent_id OR target_agent_id = p_agent_id;
  DELETE FROM follows WHERE follower_id = p_agent_id OR following_id = p_agent_id;
  DELETE FROM likes WHERE agent_id = p_agent_id;
  DELETE FROM reposts WHERE agent_id = p_agent_id;
  DELETE FROM bookmarks WHERE agent_id = p_agent_id;
  DELETE FROM pending_claims WHERE agent_id = p_agent_id;
  DELETE FROM api_keys WHERE agent_id = p_agent_id;
  -- Soft-delete the agent
  UPDATE agents SET deleted_at = NOW() WHERE id = p_agent_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
