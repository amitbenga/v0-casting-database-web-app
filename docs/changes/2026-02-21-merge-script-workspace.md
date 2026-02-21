# Merge: Script Workspace from `claude/add-script-handling-IH2JC`

**Date:** 2026-02-21  
**Source Branch:** `claude/add-script-handling-IH2JC`  
**Target Branch:** `v0/amit-2370-1641a336`

---

## Summary

Merged the Script Workspace feature (Module 4) from the claude branch into the v0 branch.
This feature enables importing Excel-based dubbing scripts, viewing/editing script lines per project,
and assigning actors to lines based on role casting.

---

## New Files Added

| File | Description |
|------|-------------|
| `components/projects/script-workspace-tab.tsx` | Main UI for the script workspace tab — table view, inline editing, import button, filtering |
| `components/projects/script-lines-import-dialog.tsx` | Dialog for importing Excel files with column mapping and preview |
| `lib/actions/script-line-actions.ts` | Server Actions: `getScriptLines`, `upsertScriptLines`, `deleteScriptLine`, `deleteAllScriptLines` |
| `lib/parser/excel-parser.ts` | Extended with `parseScriptLinesFromExcel()` and `autoDetectScriptLineColumns()` |

## Modified Files (Conflict Resolution)

### `lib/types.ts`
- **Kept from v0:** `RoleCasting` with `castings: RoleCasting[]` on `ProjectRole`, `sortBy: "shuffle"` on `FolderSortOption`
- **Added from claude:** `RecStatus`, `ScriptLine`, `ScriptLineInput` types

### `app/projects/[id]/page.tsx`
- **Kept from v0:** `grid-cols-4` tab layout (was `grid-cols-3` in claude), `casting_project_scripts` query
- **Added from claude:** New "workspace" tab trigger and `<ScriptWorkspaceTab>` content panel

---

## Database Migration

### Migration 025: `script_lines` table

**File:** `scripts/025_create_script_lines_table.sql`  
**Status:** Executed successfully

```sql
CREATE TABLE script_lines (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
  script_id TEXT,
  line_number INTEGER,
  timecode TEXT,
  role_name TEXT NOT NULL,
  actor_id TEXT REFERENCES actors(id) ON DELETE SET NULL,
  source_text TEXT,
  translation TEXT,
  rec_status TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Indexes:** project_id, (project_id, role_name), (project_id, line_number), actor_id  
**RLS:** Public access (SELECT, INSERT, UPDATE, DELETE) — consistent with all other tables

---

## Verification Checklist

- [x] New files copied from claude branch
- [x] types.ts merged — both v0 and claude additions preserved
- [x] Project detail page merged — 4-tab layout with workspace tab
- [x] script_lines table created in Supabase
- [x] RLS policies set to public access (matching project pattern)
- [x] excel-parser.ts extended with script line parsing functions
- [x] No existing functionality broken

## Risks and Notes

- The `script-line-actions.ts` uses `createClient()` from `@/lib/supabase/server` for server-side operations
- Excel parsing depends on the `xlsx` package — verify it's in package.json
- `rec_status` values are stored as TEXT, validated at app level (`"הוקלט" | "Optional" | "לא הוקלט"`)
