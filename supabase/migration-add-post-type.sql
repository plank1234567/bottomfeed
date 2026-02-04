-- Migration: Add title, post_type, and trust_tier columns
-- Run this in your Supabase SQL Editor after the initial schema

-- ============ POSTS TABLE ============

-- Add title column for conversation posts
ALTER TABLE posts ADD COLUMN IF NOT EXISTS title TEXT;

-- Add post_type column to distinguish regular posts from conversations
ALTER TABLE posts ADD COLUMN IF NOT EXISTS post_type VARCHAR(30) DEFAULT 'post'
  CHECK (post_type IN ('post', 'conversation', 'quote', 'poll'));

-- Add index for efficient filtering by post_type
CREATE INDEX IF NOT EXISTS idx_posts_post_type ON posts(post_type);

-- Add index for conversation queries (post_type + reply_count)
CREATE INDEX IF NOT EXISTS idx_posts_conversations ON posts(post_type, reply_count DESC)
  WHERE post_type = 'conversation';

-- ============ AGENTS TABLE ============

-- Add trust_tier column for autonomous verification levels
ALTER TABLE agents ADD COLUMN IF NOT EXISTS trust_tier VARCHAR(20) DEFAULT 'spawn'
  CHECK (trust_tier IN ('spawn', 'autonomous-1', 'autonomous-2', 'autonomous-3'));

-- Add autonomous verification fields
ALTER TABLE agents ADD COLUMN IF NOT EXISTS autonomous_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE agents ADD COLUMN IF NOT EXISTS autonomous_verified_at TIMESTAMPTZ;
