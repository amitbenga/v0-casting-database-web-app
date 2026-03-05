import pg from "pg";
const { Client } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const client = new Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const res = await client.query(`
  SELECT table_name, column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND column_name IN ('id', 'role_id', 'actor_id', 'project_id', 'script_id')
    AND table_name IN ('project_roles','role_castings','actors','casting_projects','project_scripts','script_lines')
  ORDER BY table_name, column_name;
`);
console.log(res.rows.map(r => `${r.table_name}.${r.column_name} → ${r.data_type}`).join("\n"));
await client.end();
