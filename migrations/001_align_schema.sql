-- =====================================================
-- Migration: Align Database Schema with Code
-- Date: 2026-02-16
-- Description: Fix type mismatches and ensure all required columns exist
-- =====================================================

-- ===================
-- 1. VAT Status Fix
-- ===================
-- Ensure vat_status column uses correct type and values
-- Valid values: 'ptor', 'murshe', 'artist_salary'

ALTER TABLE actors
  ALTER COLUMN vat_status TYPE text;

-- Add constraint to ensure only valid values
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'actors_vat_status_check'
  ) THEN
    ALTER TABLE actors
      ADD CONSTRAINT actors_vat_status_check
      CHECK (vat_status IN ('ptor', 'murshe', 'artist_salary'));
  END IF;
END $$;

-- ===================
-- 2. Singing Fields
-- ===================
-- Ensure singing-related columns exist with correct types

-- singing_styles: Should be JSONB array of {style, level}
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS singing_styles JSONB DEFAULT '[]'::jsonb;

-- singing_level: Legacy field (may still be in use)
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS singing_level text;

-- singing_styles_other: JSONB array of {name, level}
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS singing_styles_other JSONB DEFAULT '[]'::jsonb;

-- singing_sample_url: URL to singing sample (Supabase Storage preferred)
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS singing_sample_url text;

-- youtube_link: YouTube link for actor's work
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS youtube_link text;

-- ===================
-- 3. Dubbing Experience
-- ===================
-- Dubbing experience in years (numeric field)

ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS dubbing_experience_years integer DEFAULT 0;

-- ===================
-- 4. Other Fields
-- ===================
-- Ensure other_lang_text exists for additional languages
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS other_lang_text text;

-- Ensure is_draft exists for draft submissions
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS is_draft boolean DEFAULT false;

-- ===================
-- 5. Timestamps
-- ===================
-- Ensure updated_at exists for tracking changes
ALTER TABLE actors
  ADD COLUMN IF NOT EXISTS updated_at timestamptz;

-- Create trigger to auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS update_actors_updated_at ON actors;
CREATE TRIGGER update_actors_updated_at
  BEFORE UPDATE ON actors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ===================
-- 6. Actor Submissions Table
-- ===================
-- Ensure actor_submissions table exists for public form submissions

CREATE TABLE IF NOT EXISTS actor_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name text NOT NULL,
  gender text NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  birth_year integer,
  phone text NOT NULL,
  email text,
  city text,
  image_url text,
  voice_sample_url text,
  singing_sample_url text,
  youtube_link text,
  singing_styles jsonb DEFAULT '[]'::jsonb,
  singing_level text,
  singing_styles_other jsonb DEFAULT '[]'::jsonb,
  is_singer boolean DEFAULT false,
  is_course_grad boolean DEFAULT false,
  vat_status text CHECK (vat_status IN ('ptor', 'murshe', 'artist_salary')),
  notes text,
  skills jsonb DEFAULT '[]'::jsonb,
  languages jsonb DEFAULT '[]'::jsonb,
  other_lang_text text,
  dubbing_experience_years integer DEFAULT 0,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'merged')),
  reviewed_by uuid REFERENCES auth.users(id),
  reviewed_at timestamptz,
  merged_actor_id uuid REFERENCES actors(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create index on status for faster queries
CREATE INDEX IF NOT EXISTS idx_actor_submissions_status
  ON actor_submissions(status);

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_actor_submissions_created_at
  ON actor_submissions(created_at DESC);

-- ===================
-- 7. Projects Schema
-- ===================
-- Ensure project tables have correct structure

-- casting_projects table
CREATE TABLE IF NOT EXISTS casting_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  status text DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
  notes text,
  director text,
  casting_director text,
  project_date date,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- project_roles table
CREATE TABLE IF NOT EXISTS project_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  role_name_normalized text,
  parent_role_id uuid REFERENCES project_roles(id) ON DELETE CASCADE,
  description text,
  replicas_needed integer DEFAULT 0,
  source text DEFAULT 'manual' CHECK (source IN ('manual', 'script')),
  created_at timestamptz DEFAULT now()
);

-- role_castings table
CREATE TABLE IF NOT EXISTS role_castings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  status text DEFAULT 'באודישן' CHECK (status IN ('באודישן', 'בליהוק', 'מלוהק')),
  notes text,
  replicas_planned integer,
  replicas_final integer,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(role_id, actor_id)
);

-- role_conflicts table
CREATE TABLE IF NOT EXISTS role_conflicts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  role_id_a uuid NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
  role_id_b uuid NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
  warning_type text NOT NULL,
  scene_reference text,
  evidence_json jsonb,
  created_at timestamptz DEFAULT now()
);

-- ===================
-- 8. Script Processing Tables
-- ===================
-- Tables for script parsing functionality

-- project_scripts table
CREATE TABLE IF NOT EXISTS project_scripts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  file_name text NOT NULL,
  file_type text NOT NULL,
  file_size_bytes bigint NOT NULL,
  processing_status text DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'error')),
  applied_at timestamptz,
  created_at timestamptz DEFAULT now()
);

-- script_extracted_roles table
CREATE TABLE IF NOT EXISTS script_extracted_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES project_scripts(id) ON DELETE CASCADE,
  role_name text NOT NULL,
  role_type text DEFAULT 'regular' CHECK (role_type IN ('regular', 'combined', 'group', 'ambiguous')),
  dialogue_count integer DEFAULT 0,
  replicas_count integer,
  first_appearance_script text,
  notes text,
  created_at timestamptz DEFAULT now()
);

-- script_casting_warnings table
CREATE TABLE IF NOT EXISTS script_casting_warnings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  script_id uuid NOT NULL REFERENCES project_scripts(id) ON DELETE CASCADE,
  role_id_a uuid NOT NULL REFERENCES script_extracted_roles(id) ON DELETE CASCADE,
  role_id_b uuid NOT NULL REFERENCES script_extracted_roles(id) ON DELETE CASCADE,
  warning_type text NOT NULL,
  scene_reference text,
  created_at timestamptz DEFAULT now()
);

-- ===================
-- 9. Folders Table
-- ===================
-- Table for organizing actors into folders

CREATE TABLE IF NOT EXISTS folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  color text,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- actor_folders junction table
CREATE TABLE IF NOT EXISTS actor_folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id uuid NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
  folder_id uuid NOT NULL REFERENCES folders(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  UNIQUE(actor_id, folder_id)
);

-- ===================
-- 10. Indexes for Performance
-- ===================

-- Actors indexes
CREATE INDEX IF NOT EXISTS idx_actors_gender ON actors(gender);
CREATE INDEX IF NOT EXISTS idx_actors_birth_year ON actors(birth_year);
CREATE INDEX IF NOT EXISTS idx_actors_is_singer ON actors(is_singer);
CREATE INDEX IF NOT EXISTS idx_actors_vat_status ON actors(vat_status);
CREATE INDEX IF NOT EXISTS idx_actors_created_at ON actors(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_actors_full_name ON actors(full_name);

-- Projects indexes
CREATE INDEX IF NOT EXISTS idx_project_roles_project_id ON project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_project_roles_parent_role_id ON project_roles(parent_role_id);
CREATE INDEX IF NOT EXISTS idx_role_castings_project_id ON role_castings(project_id);
CREATE INDEX IF NOT EXISTS idx_role_castings_role_id ON role_castings(role_id);
CREATE INDEX IF NOT EXISTS idx_role_castings_actor_id ON role_castings(actor_id);

-- Scripts indexes
CREATE INDEX IF NOT EXISTS idx_project_scripts_project_id ON project_scripts(project_id);
CREATE INDEX IF NOT EXISTS idx_script_extracted_roles_script_id ON script_extracted_roles(script_id);

-- ===================
-- 11. Data Migration
-- ===================
-- Migrate any existing data to new format if needed

-- Convert any NULL vat_status to default 'ptor'
UPDATE actors
SET vat_status = 'ptor'
WHERE vat_status IS NULL;

-- Convert any NULL singing_styles to empty array
UPDATE actors
SET singing_styles = '[]'::jsonb
WHERE singing_styles IS NULL;

-- Convert any NULL singing_styles_other to empty array
UPDATE actors
SET singing_styles_other = '[]'::jsonb
WHERE singing_styles_other IS NULL;

-- Set dubbing_experience_years to 0 if NULL
UPDATE actors
SET dubbing_experience_years = 0
WHERE dubbing_experience_years IS NULL;

-- ===================
-- 12. RLS Policies (Row Level Security)
-- ===================
-- Enable RLS and create basic policies

ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE casting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;

-- Public read access for authenticated users
CREATE POLICY "Authenticated users can read actors"
  ON actors FOR SELECT
  TO authenticated
  USING (true);

-- Admin can do everything
CREATE POLICY "Admins can do everything on actors"
  ON actors FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM auth.users
      WHERE auth.users.id = auth.uid()
      AND auth.users.email LIKE '%@admin.%'
    )
  );

-- Public can insert submissions
CREATE POLICY "Anyone can submit actor applications"
  ON actor_submissions FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only authenticated users can read submissions
CREATE POLICY "Authenticated users can read submissions"
  ON actor_submissions FOR SELECT
  TO authenticated
  USING (true);

-- ===================
-- 13. Verification
-- ===================
-- Verify the schema is correct

DO $$
BEGIN
  -- Check actors table has all required columns
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actors' AND column_name = 'singing_styles'
  ) THEN
    RAISE EXCEPTION 'Column singing_styles missing from actors table';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'actors' AND column_name = 'dubbing_experience_years'
  ) THEN
    RAISE EXCEPTION 'Column dubbing_experience_years missing from actors table';
  END IF;

  RAISE NOTICE 'Schema verification passed!';
END $$;
