-- Migration 005: Add performance indexes
-- Safe to run on production: all CREATE INDEX IF NOT EXISTS, all CONCURRENTLY-safe
-- No schema changes, no data modifications, fully idempotent.
-- Date: 2026-03-05

-- ─────────────────────────────────────────────
-- actors
-- ─────────────────────────────────────────────

-- Full-text trigram index for actor name autocomplete / search
-- Requires pg_trgm extension (enabled on all Supabase projects by default)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX IF NOT EXISTS idx_actors_full_name_trgm
  ON actors USING GIN (full_name gin_trgm_ops);

-- Phone lookup (used in dedup checks and actor search)
CREATE INDEX IF NOT EXISTS idx_actors_phone
  ON actors (phone)
  WHERE phone IS NOT NULL;

-- ─────────────────────────────────────────────
-- role_castings
-- ─────────────────────────────────────────────

-- Actor page: list all projects/roles an actor is cast in
CREATE INDEX IF NOT EXISTS idx_role_castings_actor_id
  ON role_castings (actor_id);

-- Casting status filter (e.g. filtering "confirmed" castings)
CREATE INDEX IF NOT EXISTS idx_role_castings_actor_status
  ON role_castings (actor_id, status)
  WHERE status IS NOT NULL;

-- ─────────────────────────────────────────────
-- project_roles
-- ─────────────────────────────────────────────

-- Loading all roles for a project (most common query in casting workspace)
CREATE INDEX IF NOT EXISTS idx_project_roles_project_id
  ON project_roles (project_id);

-- Source filter (script vs manual) used in roles-tab filtering
CREATE INDEX IF NOT EXISTS idx_project_roles_project_source
  ON project_roles (project_id, source);

-- ─────────────────────────────────────────────
-- project_scripts (formerly casting_project_scripts)
-- ─────────────────────────────────────────────

-- Loading all scripts for a project
CREATE INDEX IF NOT EXISTS idx_project_scripts_project_id
  ON project_scripts (project_id);

-- Parse status filter (pending / done / error) in scripts-tab
CREATE INDEX IF NOT EXISTS idx_project_scripts_parse_status
  ON project_scripts (project_id, parse_status)
  WHERE parse_status IS NOT NULL;

-- ─────────────────────────────────────────────
-- script_lines
-- ─────────────────────────────────────────────

-- Pagination / ordering in script workspace (project + line number)
CREATE INDEX IF NOT EXISTS idx_script_lines_project_line_number
  ON script_lines (project_id, line_number);

-- Filter by role name within a project (existing + this adds covering for role_name)
CREATE INDEX IF NOT EXISTS idx_script_lines_project_role_name
  ON script_lines (project_id, role_name);

-- rec_status filter (הוקלט / לא הוקלט / Optional) in workspace
CREATE INDEX IF NOT EXISTS idx_script_lines_project_rec_status
  ON script_lines (project_id, rec_status)
  WHERE rec_status IS NOT NULL;

-- ─────────────────────────────────────────────
-- actor_folders / folder_actors
-- ─────────────────────────────────────────────

-- Count actors in folder (used in folder list page)
CREATE INDEX IF NOT EXISTS idx_folder_actors_folder_id
  ON actor_folders (folder_id)
  WHERE folder_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- submissions (intake form)
-- ─────────────────────────────────────────────

-- Admin page: filter by review status
CREATE INDEX IF NOT EXISTS idx_submissions_review_status
  ON submissions (review_status)
  WHERE review_status IS NOT NULL;

-- Admin page: newest-first ordering
CREATE INDEX IF NOT EXISTS idx_submissions_created_at
  ON submissions (created_at DESC);
