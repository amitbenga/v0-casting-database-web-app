import pg from "pg";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Client } = pg;
const client = new Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING, ssl: { rejectUnauthorized: false } });

const TABLES = [
  "casting_projects",
  "project_roles",
  "role_castings",
  "actors",
  "project_scripts",
  "script_lines",
  "role_conflicts",
  "project_summary",        // view 006
  "actor_project_summary",  // view 006
  "role_casting_flat",      // view 006
];

async function main() {
  await client.connect();
  console.log("Connected.\n");

  for (const table of TABLES) {
    try {
      const res = await client.query(`SELECT * FROM ${table} LIMIT 1`);
      const cols = res.fields.map(f => f.name);
      console.log(`OK  ${table.padEnd(30)} (${res.rowCount} row, cols: ${cols.slice(0,6).join(", ")}${cols.length > 6 ? "…" : ""})`);
    } catch (err) {
      console.error(`ERR ${table.padEnd(30)} → ${err.message}`);
    }
  }

  // RLS check: try with anon key via REST to see what a browser client would get
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  console.log("\n--- Anon (browser) access check ---");
  for (const table of ["casting_projects","project_roles","role_castings","actors","project_scripts","script_lines"]) {
    try {
      const res = await fetch(`${supabaseUrl}/rest/v1/${table}?limit=1`, {
        headers: { apikey: anonKey, Authorization: `Bearer ${anonKey}` }
      });
      const body = await res.json();
      if (res.ok) {
        console.log(`OK  ${table.padEnd(30)} (${Array.isArray(body) ? body.length : "?"} rows returned)`);
      } else {
        console.error(`ERR ${table.padEnd(30)} → ${JSON.stringify(body)}`);
      }
    } catch (err) {
      console.error(`ERR ${table.padEnd(30)} → ${err.message}`);
    }
  }

  await client.end();
}

main().catch(e => { console.error(e); process.exit(1); });
