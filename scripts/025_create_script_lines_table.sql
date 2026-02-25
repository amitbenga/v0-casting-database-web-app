-- Migration 025: Script Workspace — script_lines table
-- Module 4: Script Workspace (replaces Excel for dubbing line management)
-- Each row = one replica/line in the dubbing script
-- Based on: claude/add-script-handling-IH2JC branch migration 004_script_lines.sql

CREATE TABLE IF NOT EXISTS script_lines (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  script_id TEXT,
  line_number INTEGER,
  timecode TEXT,
  role_name TEXT NOT NULL,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  source_text TEXT,
  translation TEXT,
  rec_status TEXT,
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

CREATE INDEX IF NOT EXISTS idx_script_lines_actor_id
  ON script_lines(actor_id);

-- RLS: match existing project pattern (public access, no auth required)
ALTER TABLE script_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow read access for all users" ON public.script_lines FOR SELECT USING (true);
CREATE POLICY "Allow insert for all users" ON public.script_lines FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all users" ON public.script_lines FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for all users" ON public.script_lines FOR DELETE USING (true);
