-- Add is_draft column to actors table
-- Allows saving actors as drafts before publishing
ALTER TABLE public.actors ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false;
