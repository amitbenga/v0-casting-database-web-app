import pg from "pg";
process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
const { Client } = pg;

const connectionString = process.env.POSTGRES_URL_NON_POOLING || process.env.POSTGRES_URL;
if (!connectionString) { console.error("Missing POSTGRES_URL"); process.exit(1); }

const SQL = `
-- VIEW 1: project_summary
CREATE OR REPLACE VIEW project_summary AS
SELECT
  p.id, p.name, p.status, p.director, p.casting_director,
  p.project_date, p.notes, p.created_at, p.updated_at,
  COUNT(DISTINCT pr.id)                                            AS roles_count,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.parent_role_id IS NULL)  AS main_roles_count,
  COUNT(DISTINCT rc.actor_id)                                      AS unique_actors_count,
  COUNT(DISTINCT rc.id)                                            AS castings_count,
  COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'מלוהק')         AS casted_count,
  COUNT(DISTINCT ps.id)                                            AS scripts_count,
  COALESCE(SUM(sl_stats.total_lines), 0)::int                      AS total_lines,
  COALESCE(SUM(sl_stats.recorded_lines), 0)::int                   AS recorded_lines
FROM casting_projects p
LEFT JOIN project_roles pr ON pr.project_id = p.id
LEFT JOIN role_castings rc ON rc.role_id = pr.id
LEFT JOIN project_scripts ps ON ps.project_id = p.id
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                     AS total_lines,
    COUNT(*) FILTER (WHERE sl.rec_status = 'הוקלט')             AS recorded_lines
  FROM script_lines sl
  WHERE sl.project_id = p.id AND sl.script_id = ps.id::text
) sl_stats ON true
GROUP BY p.id, p.name, p.status, p.director, p.casting_director,
         p.project_date, p.notes, p.created_at, p.updated_at;

-- VIEW 2: actor_project_summary
CREATE OR REPLACE VIEW actor_project_summary AS
SELECT
  a.id                                AS actor_id,
  a.full_name, a.image_url, a.gender,
  COUNT(DISTINCT rc.id)               AS total_castings,
  COUNT(DISTINCT pr.project_id)       AS projects_count,
  COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'מלוהק') AS casted_roles_count,
  COALESCE(SUM(pr.replicas_count), 0)::int AS total_replicas
FROM actors a
LEFT JOIN role_castings rc ON rc.actor_id = a.id
LEFT JOIN project_roles pr ON pr.id = rc.role_id
GROUP BY a.id, a.full_name, a.image_url, a.gender;

-- VIEW 3: role_casting_flat
CREATE OR REPLACE VIEW role_casting_flat AS
SELECT
  pr.id            AS role_id,
  pr.project_id,
  pr.role_name,
  pr.role_name_normalized,
  pr.parent_role_id,
  pr.description,
  pr.replicas_count,
  pr.replicas_needed,
  pr.source,
  pr.created_at    AS role_created_at,
  rc.id            AS casting_id,
  rc.actor_id,
  rc.status        AS casting_status,
  rc.notes         AS casting_notes,
  rc.replicas_planned,
  rc.replicas_final,
  a.full_name      AS actor_full_name,
  a.image_url      AS actor_image_url,
  a.gender         AS actor_gender,
  a.voice_sample_url AS actor_voice_sample_url
FROM project_roles pr
LEFT JOIN role_castings rc ON rc.role_id = pr.id
LEFT JOIN actors a ON a.id = rc.actor_id;
`;

async function run() {
  const client = new Client({ connectionString, ssl: { rejectUnauthorized: false } });
  await client.connect();
  console.log("Connected. Running Migration 006 — Performance Views...\n");

  try {
    await client.query(SQL);
    console.log("All 3 views created/replaced successfully.\n");

    // Verify
    const result = await client.query(`
      SELECT table_name AS view_name
      FROM information_schema.views
      WHERE table_schema = 'public'
        AND table_name IN ('project_summary', 'actor_project_summary', 'role_casting_flat')
      ORDER BY table_name;
    `);
    console.log("Verified views:", result.rows.map(r => r.view_name).join(", "));
    console.log("\nMigration 006 completed successfully.");
  } finally {
    await client.end();
  }
}

run().catch(err => { console.error("Error:", err.message); process.exit(1); });
