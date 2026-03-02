/**
 * scripts/run_migrations.js
 *
 * Runs every *.sql file inside /migrations in ascending filename order.
 * Safe to re-run: SQL files use IF NOT EXISTS / DO $$ blocks to stay idempotent.
 *
 * Usage:
 *   node scripts/run_migrations.js
 *
 * Env vars (at least one required):
 *   POSTGRES_URL_NON_POOLING   (preferred — avoids PgBouncer limits on DDL)
 *   POSTGRES_URL               (fallback)
 */

import pg from "pg";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Allow self-signed certs (Supabase / sandbox environment)
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

const { Client } = pg;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, "../migrations");

// ── helpers ────────────────────────────────────────────────────────────────

function getMigrationFiles() {
  return fs
    .readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith(".sql"))
    .sort(); // lexicographic = numeric prefix order (001, 002, …)
}

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      filename   TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
}

async function isApplied(client, filename) {
  const { rows } = await client.query(
    "SELECT 1 FROM _migrations WHERE filename = $1",
    [filename]
  );
  return rows.length > 0;
}

async function markApplied(client, filename) {
  await client.query(
    "INSERT INTO _migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
    [filename]
  );
}

// ── main ───────────────────────────────────────────────────────────────────

async function runMigrations() {
  const connectionString =
    process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;

  if (!connectionString) {
    console.error(
      "ERROR: Missing POSTGRES_URL_NON_POOLING or POSTGRES_URL env var."
    );
    process.exit(1);
  }

  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected to database.");

  await ensureMigrationsTable(client);

  const files = getMigrationFiles();
  console.log(`Found ${files.length} migration file(s) in /migrations.\n`);

  let applied = 0;
  let skipped = 0;

  for (const filename of files) {
    const alreadyRan = await isApplied(client, filename);

    if (alreadyRan) {
      console.log(`  SKIP  ${filename}  (already applied)`);
      skipped++;
      continue;
    }

    const filepath = path.join(MIGRATIONS_DIR, filename);
    const sql = fs.readFileSync(filepath, "utf8");

    console.log(`  RUN   ${filename}`);
    try {
      await client.query(sql);
      await markApplied(client, filename);
      console.log(`  OK    ${filename}`);
      applied++;
    } catch (err) {
      console.error(`  FAIL  ${filename}`);
      console.error(`        ${err.message}`);
      await client.end();
      process.exit(1);
    }
  }

  await client.end();
  console.log(
    `\nDone. Applied: ${applied}, Skipped (already ran): ${skipped}.`
  );
}

runMigrations().catch((err) => {
  console.error("Unexpected error:", err.message);
  process.exit(1);
});
