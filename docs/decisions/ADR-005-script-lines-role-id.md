# ADR-005: Script Line Role Identity via `role_id`

**Date:** 2026-03-02  
**Status:** Accepted

## Context

Recording progress metrics were based on `script_lines.role_name` (free text).  
That field is useful for display and translation workflows, but it is not stable enough for analytics:

- the same character can appear with spelling variants
- translators can intentionally change the label
- imports from different files may use slightly different naming

As a result, aggregation by role can drift and produce inconsistent progress numbers.

## Decision

Add a nullable `script_lines.role_id` foreign key to `project_roles(id)`.

Identity vs display model:

- `role_id` is the stable identity key for metrics, grouping, and cross-table joins.
- `role_name` stays free text for display/editorial use (including translation-specific wording).

API behavior during rollout:

- Preferred path: aggregate metrics from rows where `role_id IS NOT NULL`.
- `unmatched` explicitly counts rows where `role_id IS NULL`.
- Temporary fallback (when `role_id` column is not deployed yet): aggregate all rows and return `unmatched = 0`.

## Consequences

### Positive

- Stable and deterministic role-level metrics.
- Clean joins from script lines to `project_roles` for role summaries.
- Keeps editorial flexibility in `role_name` without breaking analytics.

### Trade-offs

- There is a transition period where some rows may not be linked (`role_id = NULL`).
- Import and sync flows need gradual updates to write `role_id` when available.

## Rollout Notes

1. Deploy DB change adding nullable `script_lines.role_id` FK to `project_roles`.
2. Keep API fallback active so production does not break before/while migration is rolling out.
3. Gradually backfill existing lines to set `role_id` where mapping is known.
4. Update import/assignment flows to write `role_id` going forward.
5. After high backfill coverage, monitor `unmatched` as a data quality signal.
