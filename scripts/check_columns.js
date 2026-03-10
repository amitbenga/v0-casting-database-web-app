import pg from "pg";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Client } = pg;
const client = new Client({
  connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL,
  ssl: { rejectUnauthorized: false },
});
await client.connect();
const { rows } = await client.query(`
  SELECT column_name, data_type
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'project_scripts'
  ORDER BY ordinal_position;
`);
console.log("project_scripts columns:");
rows.forEach(r => console.log(" ", r.column_name, "-", r.data_type));
await client.end();
