-- Migration 003: Script Workspace — script_lines table
-- Module 4: Script Workspace (replaces Excel for dubbing line management)
-- Each row = one replica/line in the dubbing script

CREATE TABLE IF NOT EXISTS script_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  -- script_id links to the source script file (nullable — lines can be added manually)
  script_id TEXT,
  -- Ordering
  line_number INTEGER,
  -- Timecode in format HH:MM:SS:FF (frames) or HH:MM:SS
  timecode TEXT,
  -- Role / character name (as appears in script, not normalized)
  role_name TEXT NOT NULL,
  -- Source dialogue (original language — English, French, etc.)
  source_text TEXT,
  -- Hebrew translation (editable in workspace)
  translation TEXT,
  -- Recording status: 'הוקלט' | 'Optional' | 'לא הוקלט' | NULL (= pending)
  rec_status TEXT,
  -- Free notes for director/translator
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for common query patterns
CREATE INDEX IF NOT EXISTS idx_script_lines_project_id
  ON script_lines(project_id);

CREATE INDEX IF NOT EXISTS idx_script_lines_project_role
  ON script_lines(project_id, role_name);

CREATE INDEX IF NOT EXISTS idx_script_lines_line_number
  ON script_lines(project_id, line_number);

-- RLS: same pattern as other tables — project members can read/write
ALTER TABLE script_lines ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read/write for now
-- (tighten per-project access later when auth is added)
CREATE POLICY "Allow all for authenticated" ON script_lines
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Allow service role full access (for server actions)
CREATE POLICY "Allow service role" ON script_lines
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
