import pg from "pg";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Client } = pg;

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString) { console.error("Missing POSTGRES_URL"); process.exit(1); }

const SQL = `
-- 1. Table
CREATE TABLE IF NOT EXISTS script_imports (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      TEXT NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  source_filename TEXT NOT NULL,
  source_type     TEXT NOT NULL CHECK (source_type IN ('pdf', 'docx', 'txt', 'excel', 'raw_text')),
  raw_text        TEXT,
  status          TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'processing', 'draft_ready', 'applied', 'failed')),
  draft_json      JSONB,
  model_used      TEXT,
  prompt_version  TEXT DEFAULT 'v1',
  tokens_used     INTEGER,
  error_message   TEXT,
  reviewed_by     TEXT,
  applied_at      TIMESTAMPTZ,
  apply_summary   JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Indexes
CREATE INDEX IF NOT EXISTS idx_script_imports_project
  ON script_imports(project_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_script_imports_status
  ON script_imports(project_id, status)
  WHERE status NOT IN ('applied', 'failed');

-- 3. Trigger
CREATE OR REPLACE FUNCTION set_script_imports_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END; $$;
DROP TRIGGER IF EXISTS trg_script_imports_updated_at ON script_imports;
CREATE TRIGGER trg_script_imports_updated_at
  BEFORE UPDATE ON script_imports
  FOR EACH ROW EXECUTE FUNCTION set_script_imports_updated_at();

-- 4. RLS
ALTER TABLE script_imports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "script_imports_select" ON script_imports;
DROP POLICY IF EXISTS "script_imports_insert" ON script_imports;
DROP POLICY IF EXISTS "script_imports_update" ON script_imports;
DROP POLICY IF EXISTS "script_imports_delete" ON script_imports;
CREATE POLICY "script_imports_select" ON script_imports FOR SELECT USING (true);
CREATE POLICY "script_imports_insert" ON script_imports FOR INSERT WITH CHECK (true);
CREATE POLICY "script_imports_update" ON script_imports FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "script_imports_delete" ON script_imports FOR DELETE USING (true);
`;

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected. Running migration 007...");
  try {
    await client.query(SQL);
    // Verify
    const res = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'script_imports'
      ORDER BY ordinal_position;
    `);
    console.log("script_imports columns:", res.rows.map(r => r.column_name).join(", "));
    console.log("Migration 007 completed successfully.");
  } finally {
    await client.end();
  }
}
run().catch(e => { console.error(e.message); process.exit(1); });
