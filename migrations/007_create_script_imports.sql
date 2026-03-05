-- Migration 007: script_imports — AI parser staging table
-- Purpose: Holds AI-generated draft output before the user reviews and applies it.
-- "AI generates draft, human applies" pattern — no direct writes to project_roles or script_lines.
-- Safe to re-run (CREATE TABLE IF NOT EXISTS + IF NOT EXISTS on all objects).

-- ────────────────────────────────────────────────
-- 1. Table
-- ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS script_imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      TEXT NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,

  -- Source info
  source_filename TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK (source_type IN ('pdf', 'docx', 'txt', 'excel', 'raw_text')),
  raw_text        TEXT,                   -- חילוץ הטקסט הגולמי (לreference + retry)

  -- AI output
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'draft_ready', 'applied', 'failed')),
  draft_json      JSONB,                  -- { roles: DraftRole[], lines: DraftLine[], warnings: DraftWarning[] }
  model_used      TEXT,                   -- e.g. 'anthropic/claude-opus-4.6'
  prompt_version  TEXT DEFAULT 'v1',
  tokens_used     INTEGER,
  error_message   TEXT,

  -- Review metadata
  reviewed_by     TEXT,                   -- user id or name
  applied_at      TIMESTAMPTZ,
  apply_summary   JSONB,                  -- { rolesCreated, linesCreated, warnings }

  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ────────────────────────────────────────────────
-- 2. Indexes
-- ────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_script_imports_project
  ON script_imports(project_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_script_imports_status
  ON script_imports(project_id, status)
  WHERE status NOT IN ('applied', 'failed');

-- ────────────────────────────────────────────────
-- 3. updated_at trigger
-- ────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_script_imports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_script_imports_updated_at ON script_imports;
CREATE TRIGGER trg_script_imports_updated_at
  BEFORE UPDATE ON script_imports
  FOR EACH ROW EXECUTE FUNCTION set_script_imports_updated_at();

-- ────────────────────────────────────────────────
-- 4. RLS (open policy — matches rest of app)
-- ────────────────────────────────────────────────
ALTER TABLE script_imports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "script_imports_select" ON script_imports;
DROP POLICY IF EXISTS "script_imports_insert" ON script_imports;
DROP POLICY IF EXISTS "script_imports_update" ON script_imports;
DROP POLICY IF EXISTS "script_imports_delete" ON script_imports;

CREATE POLICY "script_imports_select" ON script_imports FOR SELECT USING (true);
CREATE POLICY "script_imports_insert" ON script_imports FOR INSERT WITH CHECK (true);
CREATE POLICY "script_imports_update" ON script_imports FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "script_imports_delete" ON script_imports FOR DELETE USING (true);

-- ────────────────────────────────────────────────
-- 5. Comment
-- ────────────────────────────────────────────────
COMMENT ON TABLE script_imports IS
  'Staging table for AI-assisted script parsing. '
  'The AI writes draft_json here; a human review step calls applyScriptImport() '
  'which then writes to project_roles + script_lines. '
  'Records with status=applied are kept for audit; status=failed for debugging.';
