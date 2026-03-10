import pg from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Client } = pg;

const connectionString =
  process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Missing POSTGRES_URL_NON_POOLING or POSTGRES_URL");
  process.exit(1);
}

const steps = [
  // pg_trgm extension
  {
    name: "Enable pg_trgm extension",
    sql: `CREATE EXTENSION IF NOT EXISTS pg_trgm;`,
  },
  // actors
  {
    name: "idx_actors_full_name_trgm",
    sql: `CREATE INDEX IF NOT EXISTS idx_actors_full_name_trgm ON actors USING GIN (full_name gin_trgm_ops);`,
  },
  {
    name: "idx_actors_phone",
    sql: `CREATE INDEX IF NOT EXISTS idx_actors_phone ON actors (phone) WHERE phone IS NOT NULL;`,
  },
  // role_castings
  {
    name: "idx_role_castings_actor_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_role_castings_actor_id ON role_castings (actor_id);`,
  },
  {
    name: "idx_role_castings_actor_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_role_castings_actor_status ON role_castings (actor_id, status) WHERE status IS NOT NULL;`,
  },
  // project_roles
  {
    name: "idx_project_roles_project_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_roles_project_id ON project_roles (project_id);`,
  },
  {
    name: "idx_project_roles_project_source",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_roles_project_source ON project_roles (project_id, source);`,
  },
  // project_scripts
  {
    name: "idx_project_scripts_project_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_scripts_project_id ON project_scripts (project_id);`,
  },
  {
    name: "idx_project_scripts_parse_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_scripts_parse_status ON project_scripts (project_id, parse_status) WHERE parse_status IS NOT NULL;`,
  },
  // script_lines
  {
    name: "idx_script_lines_project_line_number",
    sql: `CREATE INDEX IF NOT EXISTS idx_script_lines_project_line_number ON script_lines (project_id, line_number);`,
  },
  {
    name: "idx_script_lines_project_role_name",
    sql: `CREATE INDEX IF NOT EXISTS idx_script_lines_project_role_name ON script_lines (project_id, role_name);`,
  },
  {
    name: "idx_script_lines_project_rec_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_script_lines_project_rec_status ON script_lines (project_id, rec_status) WHERE rec_status IS NOT NULL;`,
  },
  // actor_folders
  {
    name: "idx_folder_actors_folder_id",
    sql: `CREATE INDEX IF NOT EXISTS idx_folder_actors_folder_id ON actor_folders (folder_id) WHERE folder_id IS NOT NULL;`,
  },
  // submissions
  {
    name: "idx_submissions_review_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_submissions_review_status ON submissions (review_status) WHERE review_status IS NOT NULL;`,
  },
  {
    name: "idx_submissions_created_at",
    sql: `CREATE INDEX IF NOT EXISTS idx_submissions_created_at ON submissions (created_at DESC);`,
  },
];

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected. Running Migration 005: performance indexes\n");

  const results = { ok: [], skipped: [], failed: [] };

  for (const step of steps) {
    try {
      await client.query(step.sql);
      console.log(`  OK   ${step.name}`);
      results.ok.push(step.name);
    } catch (err) {
      // IF NOT EXISTS means this should never fail — but handle table-not-found gracefully
      if (err.code === "42P01") {
        console.warn(`  SKIP ${step.name} — table does not exist yet`);
        results.skipped.push(step.name);
      } else {
        console.error(`  FAIL ${step.name}: ${err.message}`);
        results.failed.push(step.name);
      }
    }
  }

  console.log(`\n--- Migration 005 summary ---`);
  console.log(`  Applied : ${results.ok.length}`);
  console.log(`  Skipped : ${results.skipped.length}`);
  console.log(`  Failed  : ${results.failed.length}`);

  if (results.failed.length > 0) {
    console.error("\nFailed steps:", results.failed);
    await client.end();
    process.exit(1);
  }

  // Verify: list all new indexes
  const verify = await client.query(`
    SELECT indexname
    FROM pg_indexes
    WHERE schemaname = 'public'
      AND indexname LIKE 'idx_%'
    ORDER BY tablename, indexname;
  `);
  console.log(`\nAll idx_ indexes in public schema (${verify.rows.length} total):`);
  verify.rows.forEach(r => console.log(`  ${r.indexname}`));

  await client.end();
  console.log("\nMigration 005 complete.");
}

run().catch(err => {
  console.error("Fatal:", err.message);
  process.exit(1);
});
