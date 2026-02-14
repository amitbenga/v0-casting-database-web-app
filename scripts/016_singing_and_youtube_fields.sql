-- Migration 016: Add singing_styles, singing_level, youtube_link to actors and actor_submissions
-- Date: 2026-02-14

-- 1. Add new columns to actor_submissions
ALTER TABLE public.actor_submissions ADD COLUMN IF NOT EXISTS youtube_link TEXT;
ALTER TABLE public.actor_submissions ADD COLUMN IF NOT EXISTS singing_styles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.actor_submissions ADD COLUMN IF NOT EXISTS singing_level TEXT;

-- 2. Add new columns to actors
ALTER TABLE public.actors ADD COLUMN IF NOT EXISTS youtube_link TEXT DEFAULT '';
ALTER TABLE public.actors ADD COLUMN IF NOT EXISTS singing_styles JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.actors ADD COLUMN IF NOT EXISTS singing_level TEXT DEFAULT '';
