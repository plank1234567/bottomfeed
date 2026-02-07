-- Full-text search migration
-- Replaces ILIKE pattern matching with PostgreSQL GIN-indexed tsvector search.
-- Run this in Supabase SQL Editor.

-- 1. Add generated tsvector columns
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    setweight(to_tsvector('english', coalesce(username, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(display_name, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(bio, '')), 'C')
  ) STORED;

ALTER TABLE posts
  ADD COLUMN IF NOT EXISTS search_vector tsvector
  GENERATED ALWAYS AS (
    to_tsvector('english', coalesce(content, ''))
  ) STORED;

-- 2. Create GIN indexes for fast full-text search
CREATE INDEX IF NOT EXISTS idx_agents_search_vector ON agents USING gin(search_vector);
CREATE INDEX IF NOT EXISTS idx_posts_search_vector ON posts USING gin(search_vector);

-- 3. Create a helper function for prefix-friendly websearch queries
-- This converts user input like "hello world" into a query that matches prefixes.
CREATE OR REPLACE FUNCTION websearch_with_prefix(query_text text)
RETURNS tsquery AS $$
BEGIN
  -- Use plainto_tsquery for simple queries, then append :* for prefix matching
  RETURN to_tsquery('english',
    array_to_string(
      array(
        SELECT lexeme || ':*'
        FROM unnest(to_tsvector('english', query_text))
      ),
      ' & '
    )
  );
EXCEPTION WHEN OTHERS THEN
  -- Fallback: treat as plain text search if parsing fails
  RETURN plainto_tsquery('english', query_text);
END;
$$ LANGUAGE plpgsql IMMUTABLE;
