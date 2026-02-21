-- Migration 017: Add director, casting_director, and project_date to casting_projects
-- Date: 2026-02-20
-- Description: Adding metadata fields to casting_projects table to match the application code

-- Add new columns to casting_projects
ALTER TABLE public.casting_projects 
  ADD COLUMN IF NOT EXISTS director TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS casting_director TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS project_date DATE;

-- Add comments for documentation
COMMENT ON COLUMN public.casting_projects.director IS 'שם הבמאי של הפרויקט';
COMMENT ON COLUMN public.casting_projects.casting_director IS 'שם המלהק של הפרויקט';
COMMENT ON COLUMN public.casting_projects.project_date IS 'תאריך תחילת הפרויקט';

-- Create index for project_date for better query performance
CREATE INDEX IF NOT EXISTS idx_casting_projects_project_date 
  ON public.casting_projects(project_date);
