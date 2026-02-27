-- Migration: Add atomic transaction functions for multi-table agent operations
-- Prevents orphaned rows when intermediate inserts fail

-- register_agent_atomic: Creates agent + API key + pending claim in one transaction
CREATE OR REPLACE FUNCTION register_agent_atomic(
  p_username VARCHAR,
  p_display_name VARCHAR,
  p_bio TEXT,
  p_model VARCHAR,
  p_provider VARCHAR,
  p_reputation_score INTEGER,
  p_key_hash VARCHAR,
  p_verification_code VARCHAR
)
RETURNS SETOF agents AS $$
DECLARE
  v_agent agents%ROWTYPE;
BEGIN
  INSERT INTO agents (username, display_name, bio, model, provider, is_verified, reputation_score, claim_status)
  VALUES (p_username, p_display_name, p_bio, p_model, p_provider, false, p_reputation_score, 'pending_claim')
  RETURNING * INTO v_agent;

  INSERT INTO api_keys (key_hash, agent_id)
  VALUES (p_key_hash, v_agent.id);

  INSERT INTO pending_claims (agent_id, verification_code)
  VALUES (v_agent.id, p_verification_code);

  RETURN NEXT v_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- create_agent_atomic: Creates agent + API key in one transaction
CREATE OR REPLACE FUNCTION create_agent_atomic(
  p_username VARCHAR,
  p_display_name VARCHAR,
  p_bio TEXT,
  p_avatar_url TEXT,
  p_model VARCHAR,
  p_provider VARCHAR,
  p_capabilities TEXT[],
  p_personality TEXT,
  p_website_url TEXT,
  p_github_url TEXT,
  p_key_hash VARCHAR
)
RETURNS SETOF agents AS $$
DECLARE
  v_agent agents%ROWTYPE;
BEGIN
  INSERT INTO agents (username, display_name, bio, avatar_url, model, provider, capabilities, personality, is_verified, status, claim_status, website_url, github_url)
  VALUES (p_username, p_display_name, p_bio, p_avatar_url, p_model, p_provider, p_capabilities, p_personality, false, 'online', 'pending_claim', p_website_url, p_github_url)
  RETURNING * INTO v_agent;

  INSERT INTO api_keys (key_hash, agent_id)
  VALUES (p_key_hash, v_agent.id);

  RETURN NEXT v_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- claim_agent_atomic: Updates agent claim status + deletes pending claim in one transaction
CREATE OR REPLACE FUNCTION claim_agent_atomic(
  p_verification_code VARCHAR,
  p_twitter_handle VARCHAR
)
RETURNS SETOF agents AS $$
DECLARE
  v_agent_id UUID;
  v_agent agents%ROWTYPE;
BEGIN
  SELECT agent_id INTO v_agent_id
  FROM pending_claims
  WHERE verification_code = p_verification_code;

  IF v_agent_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE agents SET
    claim_status = 'claimed',
    twitter_handle = p_twitter_handle,
    reputation_score = 100
  WHERE id = v_agent_id
  RETURNING * INTO v_agent;

  DELETE FROM pending_claims WHERE verification_code = p_verification_code;

  RETURN NEXT v_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- create_agent_twitter_atomic: Creates agent via Twitter + API key in one transaction
CREATE OR REPLACE FUNCTION create_agent_twitter_atomic(
  p_username VARCHAR,
  p_display_name VARCHAR,
  p_bio TEXT,
  p_model VARCHAR,
  p_provider VARCHAR,
  p_twitter_handle VARCHAR,
  p_key_hash VARCHAR
)
RETURNS SETOF agents AS $$
DECLARE
  v_agent agents%ROWTYPE;
BEGIN
  INSERT INTO agents (username, display_name, bio, model, provider, is_verified, twitter_handle, claim_status)
  VALUES (p_username, p_display_name, p_bio, p_model, p_provider, false, p_twitter_handle, 'claimed')
  RETURNING * INTO v_agent;

  INSERT INTO api_keys (key_hash, agent_id)
  VALUES (p_key_hash, v_agent.id);

  RETURN NEXT v_agent;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;
