-- =====================================================
-- Migration 004: Harden script_lines role_id FK and add composite index
-- Date: 2026-03-02
-- Description:
--   1) Ensures script_lines.role_id has a proper FK to project_roles(id)
--      even if the column was added without a FK in an earlier migration.
--      Fully idempotent: skips if any FK on that column already exists.
--   2) Adds a composite partial index on (project_id, role_match_status)
--      for fast per-project filtering of lines by match status.
-- Safe to run multiple times. Does NOT touch migrations 002 or 003.
-- =====================================================

-- -------------------------------------------------------
-- STEP 1: Add FK on role_id if not already present
-- -------------------------------------------------------
-- We check pg_constraint to see if *any* FK already references
-- script_lines(role_id). If one exists we do nothing; otherwise
-- we add the constraint. This is safe regardless of whether 003
-- already added the FK inline with ADD COLUMN.

DO $$
DECLARE
  fk_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class      t ON t.oid = c.conrelid
    JOIN   pg_attribute  a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE  c.contype    = 'f'           -- foreign key
      AND  t.relname    = 'script_lines'
      AND  a.attname    = 'role_id'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    RAISE NOTICE 'No FK found on script_lines(role_id) — adding constraint now.';
    ALTER TABLE script_lines
      ADD CONSTRAINT fk_script_lines_role_id
      FOREIGN KEY (role_id)
      REFERENCES project_roles(id)
      ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'FK on script_lines(role_id) already exists — skipping.';
  END IF;
END $$;

-- -------------------------------------------------------
-- STEP 2: Composite partial index for per-project status filtering
-- -------------------------------------------------------
-- Covers queries like:
--   WHERE project_id = $1 AND role_match_status = 'unmatched'
-- The WHERE clause keeps the index small (excludes unprocessed NULLs).

CREATE INDEX IF NOT EXISTS idx_script_lines_project_role_match_status
  ON script_lines(project_id, role_match_status)
  WHERE role_match_status IS NOT NULL;

-- -------------------------------------------------------
-- STEP 3: Verification
-- -------------------------------------------------------
DO $$
DECLARE
  fk_count   int;
  idx_exists boolean;
BEGIN
  -- Check FK
  SELECT COUNT(*) INTO fk_count
  FROM   pg_constraint c
  JOIN   pg_class      t ON t.oid = c.conrelid
  JOIN   pg_attribute  a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE  c.contype  = 'f'
    AND  t.relname  = 'script_lines'
    AND  a.attname  = 'role_id';

  IF fk_count = 0 THEN
    RAISE EXCEPTION 'Migration 004 FAILED: no FK found on script_lines(role_id) after migration.';
  END IF;

  -- Check index
  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'script_lines'
      AND indexname  = 'idx_script_lines_project_role_match_status'
  ) INTO idx_exists;

  IF NOT idx_exists THEN
    RAISE EXCEPTION 'Migration 004 FAILED: index idx_script_lines_project_role_match_status not found.';
  END IF;

  RAISE NOTICE 'Migration 004 completed successfully. FK count=%, composite index present=%',
    fk_count, idx_exists;
END $$;
