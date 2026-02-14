# UI Updates - 2026-02-14

## What was changed (UI only)

### A) Main Actors Screen (`/app/page.tsx`, `/components/actor-card.tsx`)
1. **Shuffle actors on load**: Replaced naive `Math.random()` shuffle (which re-shuffled on every pagination load) with a **stable seeded PRNG** (mulberry32). The seed is created once per component mount, so cards maintain their order during infinite scroll but shuffle on each new page load.
2. **Actor card hover badges**: `is_singer` and `is_course_grad` badges are now **slightly smaller** (text-[8px]/[10px] instead of [9px]/[11px]) but **more visually prominent** with higher contrast (`bg-amber-400 text-amber-950`, `bg-emerald-400 text-emerald-950`), a ring outline, and `backdrop-blur-sm` + `shadow-md`.

### B) Projects List (`/app/projects/page.tsx`)
3. **Voice Testing filter**: Already implemented in existing code. The `voice_testing` status filter button with orange border/text styling and the `getStatusColor`/`getStatusLabel` functions were already present. No changes needed.

### C) Roles Tab (`/components/projects/casting-workspace.tsx`)
4. **Excel import UI**: Already removed in existing CastingWorkspace component.
5. **Selection circles**: Already removed - CastingWorkspace uses click-on-role-name selection (no checkboxes).
6. **Parent/child collapsible UI**: Already removed - CastingWorkspace renders a flat list. The old `roles-tab.tsx` with Collapsible UI exists but is NOT used by the project detail page.
7. **Row selection UX**: Already implemented with Ctrl/Cmd+click toggle, Shift+click range, and action bar with "assign actor" / "delete" buttons.
8. **Total replicas header**: Already shown above the replicas column in CastingWorkspace.

### D) Scripts Tab (`/components/projects/scripts-tab.tsx`)
9. **Renamed CTA**: Changed info card instruction text from "פרסר תסריטים" to "חלץ תפקידים". The main parse button already used "חלץ תפקידים".

### E) Actors Tab (`/components/projects/actors-tab.tsx`)
10. **Removed audio/listen UI**: Removed `Play` icon import and all voice sample playback buttons from both table and card views.
11. **Aligned headers**: Table headers now read: "שחקן" | "תפקיד" | "רפליקות לתפקיד" | "סה"כ רפליקות" - matching the data columns.
12. **Replicas per role**: Added a column showing replicas breakdown per role for each actor (e.g., "ROLE_NAME: 42").
13. **Total replicas per actor**: Added a dedicated column with bold font showing sum of all role replicas.
14. **Sort by replicas**: Added a sort toggle button (ascending/descending/off) for total replicas, consistent with CastingWorkspace sort pattern.
15. **Cards view**: Updated to show per-role replicas inline and removed audio playback button.

## What was NOT touched

- **No database changes**: No migrations, no schema changes, no new tables or columns.
- **No server actions**: No changes to `/lib/actions/` files.
- **No core business logic**: Parser, fuzzy matcher, and casting logic untouched.
- **No authentication changes**.
- **`roles-tab.tsx`**: The old component with Collapsible parent/child UI was left as-is since it's not actively used (CastingWorkspace is the active roles UI).

## Notes

- The replicas display in the Actors tab relies on `replicas_planned` from `role_castings` data provided by `getProjectActorsFromCastings`. The actual source-of-truth for replicas will be handled in core code by others.
- The `voice_testing` project status assumes the DB enum has been (or will be) updated by others to include this value.
