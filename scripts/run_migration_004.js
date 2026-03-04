/**
 * scripts/run_migration_004.js
 *
 * Applies migration 004: harden script_lines.role_id FK + composite index.
 * Embeds the SQL inline so the script is self-contained when run by the
 * v0 sandbox executor (which copies only this file into its environment).
 *
 * Usage:
 *   node scripts/run_migration_004.js
 *   # or via package.json:
 *   pnpm migrate
 *
 * Env vars (at least one required):
 *   POSTGRES_URL_NON_POOLING   (preferred — avoids PgBouncer limits on DDL)
 *   POSTGRES_URL               (fallback)
 */

import pg from "pg";

// Allow self-signed certs in Supabase / sandbox environments
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { Client } = pg;

// ── SQL steps ──────────────────────────────────────────────────────────────
// Each step is idempotent. Steps run inside a single session (not a
// transaction) so IF NOT EXISTS / DO $$ guards are the safety net.

const STEP_ADD_FK = `
DO $$
DECLARE
  fk_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM   pg_constraint c
    JOIN   pg_class      t ON t.oid = c.conrelid
    JOIN   pg_attribute  a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
    WHERE  c.contype  = 'f'
      AND  t.relname  = 'script_lines'
      AND  a.attname  = 'role_id'
  ) INTO fk_exists;

  IF NOT fk_exists THEN
    RAISE NOTICE 'No FK on script_lines(role_id) — adding now.';
    ALTER TABLE script_lines
      ADD CONSTRAINT fk_script_lines_role_id
      FOREIGN KEY (role_id)
      REFERENCES project_roles(id)
      ON DELETE SET NULL;
  ELSE
    RAISE NOTICE 'FK on script_lines(role_id) already exists — skipping.';
  END IF;
END $$;
`;

const STEP_ADD_INDEX = `
CREATE INDEX IF NOT EXISTS idx_script_lines_project_role_match_status
  ON script_lines(project_id, role_match_status)
  WHERE role_match_status IS NOT NULL;
`;

const STEP_VERIFY = `
DO $$
DECLARE
  fk_count   int;
  idx_exists boolean;
BEGIN
  SELECT COUNT(*) INTO fk_count
  FROM   pg_constraint c
  JOIN   pg_class      t ON t.oid = c.conrelid
  JOIN   pg_attribute  a ON a.attrelid = t.oid AND a.attnum = ANY(c.conkey)
  WHERE  c.contype  = 'f'
    AND  t.relname  = 'script_lines'
    AND  a.attname  = 'role_id';

  IF fk_count = 0 THEN
    RAISE EXCEPTION 'Migration 004 FAILED: no FK on script_lines(role_id) after migration.';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE tablename = 'script_lines'
      AND indexname  = 'idx_script_lines_project_role_match_status'
  ) INTO idx_exists;

  IF NOT idx_exists THEN
    RAISE EXCEPTION 'Migration 004 FAILED: composite index not found.';
  END IF;

  RAISE NOTICE 'Migration 004 verified. FK count=%, composite index present=%',
    fk_count, idx_exists;
END $$;
`;

const steps = [
  { name: "Ensure FK on script_lines(role_id)", sql: STEP_ADD_FK },
  { name: "Add composite partial index (project_id, role_match_status)", sql: STEP_ADD_INDEX },
  { name: "Verify migration 004", sql: STEP_VERIFY },
];

// ── main ───────────────────────────────────────────────────────────────────

async function main() {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error("ERROR: Missing POSTGRES_URL_NON_POOLING or POSTGRES_URL.");
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to database.");
  console.log("Migration 004: Harden script_lines role_id FK and indexes\n");

  try {
    for (const step of steps) {
      console.log(`  Running: ${step.name}...`);
      await client.query(step.sql);
      console.log(`  OK`);
    }
    console.log("\nMigration 004 completed successfully.");
  } catch (err) {
    console.error("\nMigration 004 FAILED:", err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
