# 2026-03-02 — Migration 003: Add `role_id` and `role_match_status` to `script_lines`

**Branch:** `v0/role-id-migration`  
**Migration file:** `migrations/003_add_role_id_to_script_lines.sql`

---

## What changed

Two nullable columns were added to the `script_lines` table:

| Column | Type | Default | Purpose |
|---|---|---|---|
| `role_id` | `TEXT NULL` | `NULL` | FK → `project_roles.id ON DELETE SET NULL` |
| `role_match_status` | `TEXT NULL` | `NULL` | Backfill confidence: `matched` / `suggested` / `unmatched` |

Two new indexes were added:

| Index | Columns | Notes |
|---|---|---|
| `idx_script_lines_project_role_id` | `(project_id, role_id)` | Main lookup for a role's lines |
| `idx_script_lines_role_match_status` | `(role_match_status)` | Partial index (non-NULL only) |

`role_name TEXT` was **not touched** — it remains the canonical display value.

---

## Why

`script_lines.role_name` is free text parsed from the script file (e.g. `"דניאלה (V.O.)"`).  
It cannot reliably join to `project_roles` without normalization.  
Adding a stable `role_id` FK allows:
- Casting data (`role_castings`) to link directly to script lines.
- Future conflict detection to operate on a clean identity, not raw text.
- UI to show "lines for this role" without fuzzy string matching at query time.

`role_match_status` was added (low risk, one extra column) to avoid a second migration later.  
It enables the Script Workspace to surface unresolved lines (`unmatched` / `suggested`) for human review without a separate tracking table.

---

## Production safety

- Both columns are `NULL` by default → zero risk to existing rows.
- `ADD COLUMN IF NOT EXISTS` → idempotent, safe to re-run.
- FK uses `ON DELETE SET NULL` → deleting a role sets lines back to `NULL`, does not cascade-delete lines.
- No data is modified by this migration.

---

## Rollback

```sql
-- Remove indexes first
DROP INDEX IF EXISTS idx_script_lines_project_role_id;
DROP INDEX IF EXISTS idx_script_lines_role_match_status;

-- Remove columns
ALTER TABLE script_lines DROP COLUMN IF EXISTS role_match_status;
ALTER TABLE script_lines DROP COLUMN IF EXISTS role_id;
```

---

## Backfill plan (application-level, no SQL function required)

A Server Action (`actions/backfill-role-ids.ts`) should:

1. **Fetch** all `script_lines` rows where `role_id IS NULL`, grouped by `project_id`.
2. **Fetch** `project_roles` for the same `project_id`.
3. **Normalize** both sides before comparison:
   - `UPPERCASE` + `TRIM()`
   - Remove punctuation: `replace(/[.,\-\(\)]/g, '')`
   - Strip known suffixes: `(V.O.)`, `(O.S.)`, `(CONT'D)`, `(ADR)` — after uppercasing
   - Collapse multiple spaces to one
4. **Match logic** (exact normalized match only):
   - If exactly **one** `project_roles` row matches the normalized `role_name` → set `role_id`, `role_match_status = 'matched'`
   - If **multiple** candidates match → do not auto-fill; set `role_match_status = 'suggested'` + store the best candidate in a separate review queue or in `notes` temporarily
   - If **no** match → set `role_match_status = 'unmatched'`
5. **Write** updates in batches (`upsert` or `UPDATE ... WHERE id = ...`).
6. **Only fill `role_id` when the match is unambiguous** (single exact match).

### Normalization example

| Raw `role_name` | Normalized |
|---|---|
| `דניאלה (V.O.)` | `דניאלה` |
| `  ران  ` | `RAN` |
| `JOHN CONT'D` | `JOHN CONTD` |
| `Dr. Smith` | `DR SMITH` |

> The action should be idempotent: skip rows where `role_match_status IS NOT NULL` unless called with a `force` flag.

---

## Files affected

| File | Change |
|---|---|
| `migrations/003_add_role_id_to_script_lines.sql` | New migration |
| `docs/changes/2026-03-02-add-role-id-to-script-lines.md` | This file |

No UI or API route files were modified.
