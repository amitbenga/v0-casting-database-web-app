import pg from "pg";

// Allow self-signed certs for Supabase/Neon in the sandbox environment
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { Client } = pg;

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Missing POSTGRES_URL_NON_POOLING or POSTGRES_URL env var");
  process.exit(1);
}

const steps = [
  {
    name: "Add role_id column",
    sql: `ALTER TABLE script_lines ADD COLUMN IF NOT EXISTS role_id UUID NULL REFERENCES project_roles(id) ON DELETE SET NULL;`,
  },
  {
    name: "Add role_match_status column",
    sql: `ALTER TABLE script_lines ADD COLUMN IF NOT EXISTS role_match_status TEXT NULL CHECK (role_match_status IN ('matched', 'suggested', 'unmatched'));`,
  },
  {
    name: "Create index idx_script_lines_project_role_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_script_lines_project_role_id ON script_lines(project_id, role_id);`,
  },
  {
    name: "Create index idx_script_lines_role_match_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_script_lines_role_match_status ON script_lines(role_match_status) WHERE role_match_status IS NOT NULL;`,
  },
  {
    name: "Add comment on role_id",
    sql: `COMMENT ON COLUMN script_lines.role_id IS 'FK to project_roles.id. NULL means not yet matched or no match found. role_name TEXT is always kept as source of truth for display.';`,
  },
  {
    name: "Add comment on role_match_status",
    sql: `COMMENT ON COLUMN script_lines.role_match_status IS 'Backfill resolution status: matched | suggested | unmatched. NULL means the row has not been processed by the backfill action yet.';`,
  },
];

async function runMigration() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to database.");

  console.log("Starting Migration 003: Add role_id and role_match_status to script_lines\n");

  try {
    for (const step of steps) {
      console.log(`Running: ${step.name}...`);
      await client.query(step.sql);
      console.log(`  OK`);
    }

    // Verification
    console.log("\nVerifying migration...");
    const result = await client.query(`
      SELECT column_name, data_type
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = 'script_lines'
        AND column_name IN ('role_id', 'role_match_status')
      ORDER BY column_name;
    `);

    if (result.rows.length < 2) {
      console.error(`Verification FAILED: expected 2 columns, found ${result.rows.length}`);
      console.error("Found:", result.rows);
      process.exit(1);
    }

    for (const row of result.rows) {
      console.log(`  Column "${row.column_name}" exists (type: ${row.data_type})`);
    }
    console.log("\nMigration 003 completed successfully.");
  } finally {
    await client.end();
  }
}

runMigration().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
