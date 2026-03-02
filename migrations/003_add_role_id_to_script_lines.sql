-- =====================================================
-- Migration 003: Add role_id and role_match_status to script_lines
-- Date: 2026-03-02
-- Branch: v0/role-id-migration
-- Description:
--   Links each script line to a stable project_roles.id foreign key.
--   role_name TEXT is kept intact for display and normalization purposes.
--   Adds role_match_status to track backfill confidence.
-- =====================================================

-- -------------------------------------------------------
-- STEP 1: Add role_id (nullable FK → project_roles.id)
-- -------------------------------------------------------
-- Safe to run on existing data: NULL default means no rows are broken.
-- project_roles.id is TEXT PRIMARY KEY (see scripts/001_create_tables.sql).

ALTER TABLE script_lines
  ADD COLUMN IF NOT EXISTS role_id TEXT NULL
    REFERENCES project_roles(id) ON DELETE SET NULL;

-- -------------------------------------------------------
-- STEP 2: Add role_match_status
-- -------------------------------------------------------
-- Tracks how the role_id was resolved:
--   matched   – exact/normalized match found, role_id is filled
--   suggested – fuzzy match found but not auto-applied, needs human review
--   unmatched – no candidate found; role_id remains NULL
-- NULL = row has not been through the backfill process yet.

ALTER TABLE script_lines
  ADD COLUMN IF NOT EXISTS role_match_status TEXT NULL
    CHECK (role_match_status IN ('matched', 'suggested', 'unmatched'));

-- -------------------------------------------------------
-- STEP 3: Indexes
-- -------------------------------------------------------
-- Primary lookup: all lines in a project for a specific role_id
CREATE INDEX IF NOT EXISTS idx_script_lines_project_role_id
  ON script_lines(project_id, role_id);

-- Filter by match status (e.g. show all 'unmatched' in the UI)
CREATE INDEX IF NOT EXISTS idx_script_lines_role_match_status
  ON script_lines(role_match_status)
  WHERE role_match_status IS NOT NULL;

-- -------------------------------------------------------
-- STEP 4: Comments for documentation
-- -------------------------------------------------------
COMMENT ON COLUMN script_lines.role_id IS
  'FK to project_roles.id. NULL = not yet matched or no match found. '
  'role_name TEXT is always kept as source of truth for display.';

COMMENT ON COLUMN script_lines.role_match_status IS
  'Backfill resolution status: matched | suggested | unmatched. '
  'NULL means the row has not been processed by the backfill action yet.';

-- -------------------------------------------------------
-- STEP 5: Verification
-- -------------------------------------------------------
DO $$
DECLARE
  col_role_id       text;
  col_match_status  text;
BEGIN
  SELECT data_type INTO col_role_id
  FROM information_schema.columns
  WHERE table_name = 'script_lines' AND column_name = 'role_id';

  SELECT data_type INTO col_match_status
  FROM information_schema.columns
  WHERE table_name = 'script_lines' AND column_name = 'role_match_status';

  IF col_role_id IS NULL THEN
    RAISE EXCEPTION 'Migration 003 FAILED: role_id column not found on script_lines';
  END IF;

  IF col_match_status IS NULL THEN
    RAISE EXCEPTION 'Migration 003 FAILED: role_match_status column not found on script_lines';
  END IF;

  RAISE NOTICE 'Migration 003 completed successfully. role_id=%, role_match_status=%',
    col_role_id, col_match_status;
END $$;
