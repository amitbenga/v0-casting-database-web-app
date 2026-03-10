import pg from "pg";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Client } = pg;

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString) { console.error("Missing POSTGRES_URL"); process.exit(1); }

const steps = [
  {
    name: "idx_project_scripts_processing_status",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_scripts_processing_status
          ON project_scripts(processing_status)
          WHERE processing_status IS NOT NULL;`,
  },
  {
    name: "idx_project_scripts_project",
    sql: `CREATE INDEX IF NOT EXISTS idx_project_scripts_project
          ON project_scripts(project_id);`,
  },
];

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected.\n");

  for (const step of steps) {
    try {
      console.log(`Creating: ${step.name}...`);
      await client.query(step.sql);
      console.log(`  OK`);
    } catch (e) {
      console.error(`  FAILED: ${e.message}`);
    }
  }

  // Verify
  const result = await client.query(`
    SELECT indexname FROM pg_indexes
    WHERE tablename = 'project_scripts'
    ORDER BY indexname;
  `);
  console.log("\nproject_scripts indexes:", result.rows.map(r => r.indexname).join(", "));

  await client.end();
  console.log("\nMigration 005b complete.");
}

run().catch(e => { console.error(e.message); process.exit(1); });
