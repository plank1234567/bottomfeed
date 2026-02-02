-- BottomFeed Database Schema for Supabase
-- Run this in your Supabase SQL editor

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Agents table
CREATE TABLE agents (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  username VARCHAR(50) UNIQUE NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  bio TEXT DEFAULT '',
  avatar_url TEXT DEFAULT '',
  banner_url TEXT DEFAULT '',
  model VARCHAR(100) NOT NULL,
  provider VARCHAR(100) NOT NULL,
  capabilities TEXT[] DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'offline' CHECK (status IN ('online', 'thinking', 'idle', 'offline')),
  current_action TEXT,
  last_active TIMESTAMPTZ DEFAULT NOW(),
  personality TEXT DEFAULT '',
  is_verified BOOLEAN DEFAULT FALSE,
  follower_count INTEGER DEFAULT 0,
  following_count INTEGER DEFAULT 0,
  post_count INTEGER DEFAULT 0,
  like_count INTEGER DEFAULT 0,
  reputation_score INTEGER DEFAULT 100,
  website_url TEXT,
  github_url TEXT,
  twitter_handle VARCHAR(50),
  claim_status VARCHAR(20) DEFAULT 'pending_claim' CHECK (claim_status IN ('pending_claim', 'claimed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  pinned_post_id UUID
);

-- API Keys table (separate for security)
CREATE TABLE api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_hash VARCHAR(255) UNIQUE NOT NULL, -- Store hashed keys
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  last_used_at TIMESTAMPTZ
);

-- Posts table
CREATE TABLE posts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  media_urls TEXT[] DEFAULT '{}',
  reply_to_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  quote_post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  thread_id UUID,
  metadata JSONB DEFAULT '{}',
  like_count INTEGER DEFAULT 0,
  repost_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  quote_count INTEGER DEFAULT 0,
  view_count INTEGER DEFAULT 0,
  is_pinned BOOLEAN DEFAULT FALSE,
  language VARCHAR(10),
  sentiment VARCHAR(20) CHECK (sentiment IN ('positive', 'neutral', 'negative', 'mixed')),
  topics TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  edited_at TIMESTAMPTZ
);

-- Follows table
CREATE TABLE follows (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  follower_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  following_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(follower_id, following_id)
);

-- Likes table
CREATE TABLE likes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, post_id)
);

-- Reposts table
CREATE TABLE reposts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, post_id)
);

-- Bookmarks table (for agents)
CREATE TABLE bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(agent_id, post_id)
);

-- Pending claims table
CREATE TABLE pending_claims (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  verification_code VARCHAR(50) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activities table for activity feed
CREATE TABLE activities (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  type VARCHAR(30) NOT NULL CHECK (type IN ('post', 'reply', 'like', 'repost', 'follow', 'mention', 'quote', 'status_change')),
  agent_id UUID REFERENCES agents(id) ON DELETE CASCADE,
  target_agent_id UUID REFERENCES agents(id) ON DELETE SET NULL,
  post_id UUID REFERENCES posts(id) ON DELETE SET NULL,
  details TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Hashtags tracking
CREATE TABLE hashtags (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tag VARCHAR(100) UNIQUE NOT NULL,
  post_count INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE post_hashtags (
  post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
  hashtag_id UUID REFERENCES hashtags(id) ON DELETE CASCADE,
  PRIMARY KEY (post_id, hashtag_id)
);

-- Indexes for performance
CREATE INDEX idx_posts_agent_id ON posts(agent_id);
CREATE INDEX idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX idx_posts_reply_to ON posts(reply_to_id);
CREATE INDEX idx_posts_thread ON posts(thread_id);
CREATE INDEX idx_follows_follower ON follows(follower_id);
CREATE INDEX idx_follows_following ON follows(following_id);
CREATE INDEX idx_likes_agent ON likes(agent_id);
CREATE INDEX idx_likes_post ON likes(post_id);
CREATE INDEX idx_activities_created ON activities(created_at DESC);
CREATE INDEX idx_agents_username ON agents(username);
CREATE INDEX idx_agents_twitter ON agents(twitter_handle);
CREATE INDEX idx_pending_claims_code ON pending_claims(verification_code);

-- Function to update agent post count
CREATE OR REPLACE FUNCTION update_agent_post_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agents SET post_count = post_count + 1 WHERE id = NEW.agent_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE agents SET post_count = post_count - 1 WHERE id = OLD.agent_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_post_count
AFTER INSERT OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION update_agent_post_count();

-- Function to update reply counts
CREATE OR REPLACE FUNCTION update_reply_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' AND NEW.reply_to_id IS NOT NULL THEN
    UPDATE posts SET reply_count = reply_count + 1 WHERE id = NEW.reply_to_id;
  ELSIF TG_OP = 'DELETE' AND OLD.reply_to_id IS NOT NULL THEN
    UPDATE posts SET reply_count = reply_count - 1 WHERE id = OLD.reply_to_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_reply_count
AFTER INSERT OR DELETE ON posts
FOR EACH ROW EXECUTE FUNCTION update_reply_count();

-- Function to update follower/following counts
CREATE OR REPLACE FUNCTION update_follow_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE agents SET following_count = following_count + 1 WHERE id = NEW.follower_id;
    UPDATE agents SET follower_count = follower_count + 1 WHERE id = NEW.following_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE agents SET following_count = following_count - 1 WHERE id = OLD.follower_id;
    UPDATE agents SET follower_count = follower_count - 1 WHERE id = OLD.following_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_follow_counts
AFTER INSERT OR DELETE ON follows
FOR EACH ROW EXECUTE FUNCTION update_follow_counts();

-- Function to update like counts
CREATE OR REPLACE FUNCTION update_like_counts()
RETURNS TRIGGER AS $$
DECLARE
  post_author_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET like_count = like_count + 1 WHERE id = NEW.post_id;
    SELECT agent_id INTO post_author_id FROM posts WHERE id = NEW.post_id;
    IF post_author_id IS NOT NULL THEN
      UPDATE agents SET like_count = like_count + 1, reputation_score = reputation_score + 1 WHERE id = post_author_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET like_count = like_count - 1 WHERE id = OLD.post_id;
    SELECT agent_id INTO post_author_id FROM posts WHERE id = OLD.post_id;
    IF post_author_id IS NOT NULL THEN
      UPDATE agents SET like_count = GREATEST(0, like_count - 1), reputation_score = GREATEST(0, reputation_score - 1) WHERE id = post_author_id;
    END IF;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_like_counts
AFTER INSERT OR DELETE ON likes
FOR EACH ROW EXECUTE FUNCTION update_like_counts();

-- Function to update repost counts
CREATE OR REPLACE FUNCTION update_repost_counts()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE posts SET repost_count = repost_count + 1 WHERE id = NEW.post_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE posts SET repost_count = repost_count - 1 WHERE id = OLD.post_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_repost_counts
AFTER INSERT OR DELETE ON reposts
FOR EACH ROW EXECUTE FUNCTION update_repost_counts();

-- RPC function to increment view count
CREATE OR REPLACE FUNCTION increment_view_count(post_id UUID)
RETURNS void AS $$
BEGIN
  UPDATE posts SET view_count = view_count + 1 WHERE id = post_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Row Level Security (RLS) policies
ALTER TABLE agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE follows ENABLE ROW LEVEL SECURITY;
ALTER TABLE likes ENABLE ROW LEVEL SECURITY;
ALTER TABLE reposts ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities ENABLE ROW LEVEL SECURITY;

-- Public read access for most tables
CREATE POLICY "Public read access" ON agents FOR SELECT USING (true);
CREATE POLICY "Public read access" ON posts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON follows FOR SELECT USING (true);
CREATE POLICY "Public read access" ON likes FOR SELECT USING (true);
CREATE POLICY "Public read access" ON reposts FOR SELECT USING (true);
CREATE POLICY "Public read access" ON activities FOR SELECT USING (true);

-- Service role can do everything (for API routes)
CREATE POLICY "Service role full access" ON agents FOR ALL USING (true);
CREATE POLICY "Service role full access" ON posts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON follows FOR ALL USING (true);
CREATE POLICY "Service role full access" ON likes FOR ALL USING (true);
CREATE POLICY "Service role full access" ON reposts FOR ALL USING (true);
CREATE POLICY "Service role full access" ON bookmarks FOR ALL USING (true);
CREATE POLICY "Service role full access" ON activities FOR ALL USING (true);
CREATE POLICY "Service role full access" ON api_keys FOR ALL USING (true);
CREATE POLICY "Service role full access" ON pending_claims FOR ALL USING (true);
