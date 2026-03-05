import pg from "pg";
const { Client } = pg;
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const client = new Client({ connectionString: process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL, ssl: { rejectUnauthorized: false } });
await client.connect();
const res = await client.query(`SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='script_lines' ORDER BY ordinal_position`);
console.log(res.rows.map(r => `${r.column_name} (${r.data_type})`).join("\n"));
await client.end();
