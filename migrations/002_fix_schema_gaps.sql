-- =====================================================
-- Migration 002: Fix Schema Gaps (Based on Actual DB)
-- Date: 2026-02-18
-- Description: Align actors.skills and actors.languages
--              from TEXT[] to JSONB to match application code
-- =====================================================

-- ===================
-- 1. Convert skills from TEXT[] to JSONB
-- ===================
-- Currently: TEXT[] (PostgreSQL array of strings)
-- Code expects: JSONB array of {id, key, label} objects
-- Existing data: Hebrew strings like {"קריינות","מבטא רוסי"}
-- After conversion: ["קריינות","מבטא רוסי"] (JSON array)
-- The app code will handle converting to {id,key,label} objects on read

ALTER TABLE actors
  ALTER COLUMN skills TYPE jsonb
  USING COALESCE(to_jsonb(skills), '[]'::jsonb);

ALTER TABLE actors
  ALTER COLUMN skills SET DEFAULT '[]'::jsonb;

-- ===================
-- 2. Convert languages from TEXT[] to JSONB
-- ===================
-- Same conversion as skills

ALTER TABLE actors
  ALTER COLUMN languages TYPE jsonb
  USING COALESCE(to_jsonb(languages), '[]'::jsonb);

ALTER TABLE actors
  ALTER COLUMN languages SET DEFAULT '[]'::jsonb;

-- ===================
-- 3. Verification
-- ===================
DO $$
DECLARE
  skills_type text;
  languages_type text;
BEGIN
  SELECT data_type INTO skills_type
  FROM information_schema.columns
  WHERE table_name = 'actors' AND column_name = 'skills';

  SELECT data_type INTO languages_type
  FROM information_schema.columns
  WHERE table_name = 'actors' AND column_name = 'languages';

  IF skills_type != 'jsonb' THEN
    RAISE EXCEPTION 'skills column is % instead of jsonb', skills_type;
  END IF;

  IF languages_type != 'jsonb' THEN
    RAISE EXCEPTION 'languages column is % instead of jsonb', languages_type;
  END IF;

  RAISE NOTICE 'Migration 002 completed successfully! skills=%, languages=%', skills_type, languages_type;
END $$;
