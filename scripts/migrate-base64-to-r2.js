/**
 * Migration script: Base64 media in DB → Cloudflare R2
 *
 * Migrates existing Base64 data-URL payloads stored in:
 *   actors.image_url
 *   actors.voice_sample_url
 *   actors.singing_sample_url
 *   actor_submissions.image_url
 *   actor_submissions.voice_sample_url
 *   actor_submissions.singing_sample_url
 *
 * For each row that has a data: prefix:
 *   1. Decode Base64 → binary
 *   2. Upload to R2 using the canonical key convention
 *   3. Update the DB column to the R2 object key
 *
 * Run with:
 *   node scripts/migrate-base64-to-r2.js [--dry-run]
 *
 * Environment variables required (set in .env.local or Vercel):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY  (or NEXT_PUBLIC_SUPABASE_ANON_KEY for limited scope)
 *   R2_ENDPOINT
 *   R2_ACCESS_KEY_ID
 *   R2_SECRET_ACCESS_KEY
 *   R2_BUCKET_NAME
 */

import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3"
import { createClient } from "@supabase/supabase-js"
import { readFileSync, existsSync } from "fs"
import path from "path"

// ---------------------------------------------------------------------------
// Load .env.local if it exists (for local dev)
// ---------------------------------------------------------------------------
const envPath = path.resolve(process.cwd(), ".env.local")
if (existsSync(envPath)) {
  const lines = readFileSync(envPath, "utf8").split("\n")
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith("#")) continue
    const idx = trimmed.indexOf("=")
    if (idx === -1) continue
    const key = trimmed.slice(0, idx).trim()
    const value = trimmed.slice(idx + 1).trim().replace(/^['"]|['"]$/g, "")
    if (!process.env[key]) process.env[key] = value
  }
}

const DRY_RUN = process.argv.includes("--dry-run")

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const R2_ENDPOINT = process.env.R2_ENDPOINT
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
const R2_BUCKET_NAME = process.env.R2_BUCKET_NAME

for (const [k, v] of Object.entries({ SUPABASE_URL, SUPABASE_KEY, R2_ENDPOINT, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME })) {
  if (!v) { console.error(`Missing env var: ${k}`); process.exit(1) }
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)
const r2 = new S3Client({
  region: "auto",
  endpoint: R2_ENDPOINT,
  credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
})

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function sanitize(filename) {
  return filename.replace(/\s+/g, "-").replace(/[^a-zA-Z0-9.\-_]/g, "").toLowerCase()
}

function extFromMime(mimeType) {
  const map = {
    "image/jpeg": "jpg", "image/jpg": "jpg", "image/png": "png",
    "image/webp": "webp", "image/gif": "gif",
    "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/wav": "wav",
    "audio/ogg": "ogg", "audio/m4a": "m4a", "audio/x-m4a": "m4a",
    "application/pdf": "pdf",
  }
  return map[mimeType] ?? "bin"
}

async function uploadBase64(key, dataUrl) {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/)
  if (!match) return { success: false, error: "Not a valid data URL" }
  const contentType = match[1]
  const buffer = Buffer.from(match[2], "base64")
  if (DRY_RUN) {
    console.log(`  [dry-run] Would upload ${buffer.length} bytes → ${key} (${contentType})`)
    return { success: true }
  }
  await r2.send(new PutObjectCommand({ Bucket: R2_BUCKET_NAME, Key: key, Body: buffer, ContentType: contentType }))
  return { success: true }
}

// ---------------------------------------------------------------------------
// Per-table migration
// ---------------------------------------------------------------------------

async function migrateTable(tableName, idCol, fields, keyBuilders) {
  console.log(`\n--- ${tableName} ---`)

  // Build a filter: at least one field starts with "data:"
  const { data: rows, error } = await supabase
    .from(tableName)
    .select([idCol, ...fields].join(", "))
    .or(fields.map((f) => `${f}.like.data:%`).join(","))

  if (error) { console.error(`  Fetch error:`, error.message); return }
  if (!rows || rows.length === 0) { console.log(`  No Base64 rows found.`); return }

  console.log(`  Found ${rows.length} rows with Base64 data.`)
  let migrated = 0, failed = 0, skipped = 0

  for (const row of rows) {
    const id = row[idCol]
    const updates = {}
    for (const field of fields) {
      const value = row[field]
      if (!value || !value.startsWith("data:")) { skipped++; continue }

      const mimeMatch = value.match(/^data:([^;]+);base64,/)
      const ext = extFromMime(mimeMatch?.[1] ?? "")
      const filename = `${field}-${id}.${ext}`
      const key = keyBuilders[field](id, filename)

      console.log(`  [${id}] ${field} → ${key}`)
      const result = await uploadBase64(key, value)
      if (result.success) {
        updates[field] = key
        migrated++
      } else {
        console.error(`  [${id}] ${field} upload failed:`, result.error)
        failed++
      }
    }
    if (Object.keys(updates).length > 0 && !DRY_RUN) {
      const { error: updateError } = await supabase
        .from(tableName)
        .update(updates)
        .eq(idCol, id)
      if (updateError) console.error(`  [${id}] DB update failed:`, updateError.message)
    }
  }

  console.log(`  Results: ${migrated} migrated, ${failed} failed, ${skipped} skipped`)
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
console.log(`\nBase64 → R2 migration ${DRY_RUN ? "(DRY RUN)" : "(LIVE)"}`)

await migrateTable(
  "actors",
  "id",
  ["image_url", "voice_sample_url", "singing_sample_url"],
  {
    image_url: (id, name) => `actors/${id}/images/${sanitize(name)}`,
    voice_sample_url: (id, name) => `actors/${id}/voice/${sanitize(name)}`,
    singing_sample_url: (id, name) => `actors/${id}/singing/${sanitize(name)}`,
  }
)

await migrateTable(
  "actor_submissions",
  "id",
  ["image_url", "voice_sample_url", "singing_sample_url"],
  {
    image_url: (id, name) => `actor-submissions/${id}/images/${sanitize(name)}`,
    voice_sample_url: (id, name) => `actor-submissions/${id}/audio/${sanitize(name)}`,
    singing_sample_url: (id, name) => `actor-submissions/${id}/audio/${sanitize(name)}`,
  }
)

console.log("\nMigration complete.")
