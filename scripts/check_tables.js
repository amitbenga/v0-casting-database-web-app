import pg from "pg";

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { Client } = pg;
const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

if (!connectionString) {
  console.error("Missing POSTGRES_URL");
  process.exit(1);
}

async function main() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to database.\n");

  // List all tables
  const tablesResult = await client.query(`
    SELECT table_name 
    FROM information_schema.tables
    WHERE table_schema = 'public'
    ORDER BY table_name;
  `);
  
  console.log("Tables in public schema:");
  tablesResult.rows.forEach(r => console.log(`  - ${r.table_name}`));
  
  // Check specifically for the scripts tables
  console.log("\n--- Script-related tables check ---");
  const scriptTablesCheck = await client.query(`
    SELECT table_name 
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_name LIKE '%script%'
    ORDER BY table_name;
  `);
  
  if (scriptTablesCheck.rows.length === 0) {
    console.log("No tables with 'script' in name found!");
  } else {
    scriptTablesCheck.rows.forEach(r => console.log(`  Found: ${r.table_name}`));
  }

  await client.end();
}

main().catch(err => {
  console.error("Error:", err.message);
  process.exit(1);
});
