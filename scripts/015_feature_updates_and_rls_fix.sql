-- Migration: Feature Updates & RLS Fix (Manus/dev1)
-- Date: 2026-02-14

-- ===================================
-- 1. RLS Policy Fix for project_roles (CRITICAL)
-- ===================================
ALTER TABLE public.project_roles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow authenticated users to manage project_roles" ON public.project_roles;
CREATE POLICY "Allow authenticated users to manage project_roles"
ON public.project_roles FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- ===================================
-- 2. Add Singing Sample Field
-- ===================================
ALTER TABLE public.actors ADD COLUMN IF NOT EXISTS singing_sample_url TEXT DEFAULT '';
ALTER TABLE public.actor_submissions ADD COLUMN IF NOT EXISTS singing_sample_url TEXT;

-- ===================================
-- 3. Add Accents Field
-- ===================================
ALTER TABLE public.actors ADD COLUMN IF NOT EXISTS accents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.actor_submissions ADD COLUMN IF NOT EXISTS accents JSONB DEFAULT '[]'::jsonb;

-- ===================================
-- 4. Add 'voice_testing' Project Status
-- ===================================
ALTER TABLE public.casting_projects DROP CONSTRAINT IF EXISTS casting_projects_status_check;
ALTER TABLE public.casting_projects ADD CONSTRAINT casting_projects_status_check
CHECK (status IN ('not_started', 'casting', 'casted', 'recording', 'completed', 'voice_testing'));

-- ===================================
-- 5. Consolidate Replicas Count
-- ===================================
-- As per ADR 0001, `replicas_count` is the source of truth.
-- This script ensures data from the deprecated `replicas_needed` is not lost.

-- Add replicas_count if it doesn't exist (for safety, though it should)
ALTER TABLE public.project_roles ADD COLUMN IF NOT EXISTS replicas_count INT DEFAULT 0;

-- Copy data from replicas_needed to replicas_count where count is 0 or null
UPDATE public.project_roles
SET replicas_count = replicas_needed
WHERE (replicas_count IS NULL OR replicas_count = 0) AND replicas_needed > 0;

-- The `replicas_needed` column is now considered deprecated.

-- ===================================
-- 6. Add Soft Delete to Submissions
-- ===================================
ALTER TABLE public.actor_submissions ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Create an index for faster querying of non-deleted submissions
CREATE INDEX IF NOT EXISTS idx_actor_submissions_not_deleted ON public.actor_submissions (deleted_at) WHERE deleted_at IS NULL;

-- Update RLS policy to hide deleted submissions from non-admins
-- (Assuming only admins should see soft-deleted items, if ever needed)
-- For now, we will just filter them in the application query.


-- ===================================
-- End of Migration
-- ===================================
