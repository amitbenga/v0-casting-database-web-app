# UI Updates - 2026-02-14

## Summary
UI-only changes across Actors, Projects, Roles, Scripts, and project Actors tabs. No database schema, core business logic, or architecture changes were made.

---

## A) Main Actors Screen (`app/page.tsx`, `components/actor-card.tsx`)

### 1. Shuffle actors on load
- **What changed:** Actor cards are now shuffled client-side (Fisher-Yates) on each page load, using `useMemo` on the fetched actors array.
- **Why:** Ensure actors appear in a different order each session, avoiding bias toward recently added actors.
- **Note:** `ORDER BY` in the DB fetch remains `created_at DESC` for cursor pagination correctness; shuffle is applied after fetch.

### 2. Actor card hover badges
- **What changed:** `is_singer` badge now uses `bg-amber-500/90 text-white` (was `bg-background/90`). `is_course_grad` badge now uses `bg-emerald-500/90 text-white`. Both have `font-semibold` and `shadow-sm` added. Font size slightly reduced to `text-[9px] md:text-[11px]`.
- **Why:** Badges are now more visually prominent with distinct colors while maintaining Hebrew RTL design.

---

## B) Projects List (`app/projects/page.tsx`)

### 3. Status filter + Voice Testing
- **What changed:** Added `voice_testing` status button to the filter bar with distinct `border-orange-400 text-orange-500` outline style.
- **What changed:** Added `getStatusLabel()` helper to centralize status label rendering, replacing inline conditionals.
- **What changed:** Added `getStatusColor` case for `voice_testing` with transparent background and orange border.
- **Why:** Support the new "Voice Testing" project status in the UI filter and badge rendering.
- **DB note:** The actual `voice_testing` enum value must be added to the DB by others. This is UI-only preparation.

---

## C) Roles Tab UI Overhaul (`components/projects/casting-workspace.tsx`)

### 4. Removed Excel import UI
- **What changed:** Removed the "Import from Excel" dialog, `handleImportCasting`, `handleExportTemplate`, `importError` state, and related `Upload` icon import. Excel export button is preserved.
- **Why:** Excel import will move to Scripts upload flow; handled elsewhere.

### 5. Removed broken selection circles
- **What changed:** Removed `CheckCircle2` and `Circle` icons from each role row (they appeared as status indicators but had no multi-select functionality).
- **Why:** They looked like multi-select checkboxes but did nothing.

### 6. Removed parent/child expandable UI
- **What changed:** All roles (parents and children) are now rendered in a single flat list. `expandedGroups` state, `toggleGroup` function, and `Collapsible` / `ChevronDown` / `ChevronLeft` expand/collapse UI removed.
- **Why:** Each role is now a flat row at the same level. Simplifies the interface.

### 7. Click-to-select role names with multi-select
- **What changed:**
  - Role name is now a `<button>` that triggers selection on click.
  - **Simple click** selects only that role (highlight with `bg-primary/8` and `ring-primary/20`).
  - **Ctrl/Cmd+click** toggles additional roles in the selection.
  - **Shift+click** selects a range from last-clicked to current.
  - When 1+ roles are selected, a sticky action bar appears with:
    - "שבץ שחקן" button (opens actor search for bulk assign)
    - "מחק תפקיד / מחק תפקידים" button (dynamic label based on count)
    - Selection count display and clear button
  - Per-role "שיבוץ" ghost button removed in favor of the selection-based flow.
- **Why:** Replace per-row "cast" button with a multi-select UX as requested.
- **Note:** The individual role row still shows inline actor assignment search if actor is already assigned (replace/unassign).

### 8. Total replicas in column header
- **What changed:** The "רפליקות" column header now shows the total replicas count across all roles in the project below the label.
- **Why:** Quick overview of total replicas without scrolling.

---

## D) Scripts Tab (`components/projects/scripts-tab.tsx`)

### 9. Renamed CTA
- **What changed:** Button text changed from "פרסר תסריטים" to "חלץ תפקידים". Info card instruction text updated to match.
- **Why:** Clearer user-facing label for the action.

---

## E) Project Actors Tab (`components/projects/actors-tab.tsx`)

### 10. Removed audio playback UI
- **What changed:** Removed `Play` / `Pause` button and `new Audio()` playback from both table and card views. Removed `Play` icon import.
- **Why:** Audio playback is not needed at this stage.

### 11. Aligned headers to data
- **What changed:** Table headers now match the data columns: "שחקן", "תפקידים", "רפליקות לפי תפקיד", "סה"כ רפליקות".
- **Why:** Headers were misaligned with actual column content.

### 12. Replicas display per role and total per actor
- **What changed:**
  - Added "רפליקות לפי תפקיד" column showing each role's `replicas_planned` value.
  - Added "סה"כ רפליקות" column showing the sum across all assigned roles.
  - Added sortable column headers (name, roles count, total replicas) with `ArrowUpDown` icon indicators.
  - Card view also shows per-role replicas breakdown.
- **Why:** Replicas visibility is critical for casting decisions.
- **DB note:** Replicas data source-of-truth (`replicas_planned`) is provided by the existing `role_castings` table. No new DB queries or schema changes.

---

## What Was NOT Touched
- **No database changes**: No migrations, no schema modifications, no SQL scripts.
- **No core business logic changes**: No changes to `lib/actions/`, `lib/parser/`, or server-side code.
- **No authentication changes**.
- **No new routes or API endpoints**.
- **Excel export functionality preserved** (only import removed from Roles tab).
