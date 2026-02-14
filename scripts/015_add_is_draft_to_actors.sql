-- Add is_draft column to actors table
-- Allows saving actors as drafts before publishing
ALTER TABLE actors ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;

-- Index for efficient draft filtering
CREATE INDEX IF NOT EXISTS idx_actors_is_draft ON actors(is_draft) WHERE is_draft = true;
