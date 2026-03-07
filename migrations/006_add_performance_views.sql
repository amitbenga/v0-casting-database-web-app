-- Migration 006: Add performance views
-- Date: 2026-03-05
-- Purpose: Replace multi-query fetches with single-query views for project summary
--          and actor summary pages. READ-ONLY — no schema changes, no data modified.
-- Safe to re-run: uses CREATE OR REPLACE VIEW.

-- ─────────────────────────────────────────────────────────────
-- VIEW 1: project_summary
-- Replaces the 3-4 separate queries on the projects list page.
-- Returns one row per project with aggregated stats.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW project_summary AS
SELECT
  p.id,
  p.name,
  p.status,
  p.director,
  p.casting_director,
  p.project_date,
  p.notes,
  p.created_at,
  p.updated_at,

  -- Role counts
  COUNT(DISTINCT pr.id)                                          AS roles_count,
  COUNT(DISTINCT pr.id) FILTER (WHERE pr.parent_role_id IS NULL) AS main_roles_count,

  -- Actor / casting counts
  COUNT(DISTINCT rc.actor_id)                                    AS unique_actors_count,
  COUNT(DISTINCT rc.id)                                          AS castings_count,
  COUNT(DISTINCT rc.id) FILTER (WHERE rc.status = 'מלוהק')       AS casted_count,

  -- Script stats (counts directly from script_lines, independent of project_scripts)
  COUNT(DISTINCT ps.id)                                          AS scripts_count,
  COALESCE((
    SELECT COUNT(*) FROM script_lines sl2 WHERE sl2.project_id = p.id
  ), 0)::int                                                     AS total_lines,
  COALESCE((
    SELECT COUNT(*) FROM script_lines sl3 WHERE sl3.project_id = p.id AND sl3.rec_status = 'הוקלט'
  ), 0)::int                                                     AS recorded_lines,
  -- Count actors with status "מלוהק" (actual casts, not just linked)
  COUNT(DISTINCT rc.actor_id) FILTER (WHERE rc.status = 'מלוהק') AS actors_cast

FROM casting_projects p
LEFT JOIN project_roles pr
  ON pr.project_id = p.id
LEFT JOIN role_castings rc
  ON rc.role_id = pr.id
LEFT JOIN project_scripts ps
  ON ps.project_id = p.id
GROUP BY
  p.id, p.name, p.status, p.director, p.casting_director,
  p.project_date, p.notes, p.created_at, p.updated_at;

-- ─────────────────────────────────────────────────────────────
-- VIEW 2: actor_project_summary
-- For the actor detail page: how many projects and roles per actor.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW actor_project_summary AS
SELECT
  a.id                              AS actor_id,
  a.full_name,
  a.image_url,
  a.gender,
  COUNT(DISTINCT rc.id)             AS total_castings,
  COUNT(DISTINCT pr.project_id)     AS projects_count,
  COUNT(DISTINCT rc.id)
    FILTER (WHERE rc.status = 'מלוהק') AS casted_roles_count,
  COALESCE(SUM(pr.replicas_count), 0)::int AS total_replicas
FROM actors a
LEFT JOIN role_castings rc ON rc.actor_id = a.id
LEFT JOIN project_roles pr ON pr.id = rc.role_id
GROUP BY a.id, a.full_name, a.image_url, a.gender;

-- ─────────────────────────────────────────────────────────────
-- VIEW 3: role_casting_flat
-- Flat view of roles + casting for fast project workspace loads.
-- Avoids nested PostgREST joins that generate verbose JSON.
-- ─────────────────────────────────────────────────────────────
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
