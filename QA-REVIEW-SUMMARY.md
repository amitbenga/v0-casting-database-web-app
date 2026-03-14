# QA Fixes Review Summary
**Branch:** `claude/review-qa-findings-yXhjs`
**Date:** 2026-03-13
**Commits:** 5 (excluding Playwright removal)

---

## Changes by Task

### TASK-001 — Parser Stopwords (P0)
**Files:** `lib/parser/tokenizer.ts`, `lib/parser/structured-parser.ts`
**What:** Added `CHARACTER_STOPWORDS` set (~40 words) to prevent false positive role detection.
Words like SCENE, SCRIPT TITLE, END OF, CAST, CHAPTER, etc. are now filtered out.
Also rejects names starting with digits or ending with `:`.
**Test:** Upload a TXT with "SCRIPT TITLE" and "CHARACTER LIST" headers — they should NOT appear as roles.

### TASK-003 — Comments i18n (P1)
**File:** `components/actor-comments.tsx`
**What:** Translated all UI text to Hebrew:
- "Comments" → "הערות"
- "Add a comment..." → "הוסף הערה..."
- "Add Comment" → "הוסף הערה"
- Date format changed from US (`06-23-2025, 3:39 pm (PST)`) to Israeli (`23.06.2025, 16:39`)
**Test:** Open actor profile → verify comments section is fully in Hebrew.

### TASK-004 — Form Validation in Hebrew (P1)
**Files:** `app/intake/page.tsx`, `components/create-project-dialog.tsx`
**What:** Removed native HTML `required` attribute. Added custom validation with Hebrew toast messages:
- "נא למלא שם מלא"
- "נא לבחור מין"
- "נא למלא שנת לידה"
- "נא למלא שם פרויקט"
**Test:** Submit intake form / create project with empty required fields → verify Hebrew error toasts.

### TASK-005 — Draft Redirect Fix (P1)
**File:** `app/intake/page.tsx` (line 236)
**What:** Changed `router.push("/")` to `router.push("/actors")`.
**Before:** After saving a draft, user was redirected to /projects.
**After:** User is redirected to /actors where they can see their draft.
**Test:** Save a draft actor → verify redirect to actors page.

### TASK-006 — Export Toast Feedback (P1)
**File:** `app/actors/page.tsx`
**What:** Added success toast after actor export: "ייצוא הושלם — הקובץ הורד בהצלחה (X שחקנים)"
**Test:** Select actors → export → verify success toast appears.

### TASK-007 — Actor Count Updates with Filters (P1)
**File:** `app/actors/page.tsx`
**What:** Tab label now shows `תוצאות (X)` when filters are active instead of static total count.
**Test:** Filter actors by gender → verify tab shows "תוצאות (7)" instead of "כל השחקנים (14)".

### TASK-008 — Script Counter (P1)
**No changes needed.** Verified that `onScriptApplied` callback already triggers `mutate()` correctly.

### TASK-009 — Rejection Reason (P2)
**File:** `app/admin/page.tsx`
**What:** Added textarea for rejection reason in the reject dialog. Minimum 10 characters validation.
Placeholder: "לדוגמה: הקול לא מתאים לדמות, אין ניסיון מספיק..."
**Note:** UI-only — DB column `rejection_reason` not yet added (needs migration).
**Test:** Admin → reject submission → verify textarea appears, cannot submit with <10 chars.

### TASK-010 — Unified Date Format (P2)
**Files:** `lib/format-date.ts` (new), `app/projects/[id]/page.tsx`, `app/projects/page.tsx`, `components/actor-comments.tsx`
**What:** Created centralized `formatDateHe()` and `formatDateOnlyHe()` utilities.
All dates now use `he-IL` locale with `Asia/Jerusalem` timezone.
**Test:** Check dates in project list, project detail, and comments — all should be DD.MM.YYYY format.

### TASK-011 — Project Menu Sync (P2)
**File:** `app/projects/[id]/page.tsx`
**What:** Uncommented "ייצא פרויקט" option in the 3-dots menu on project detail page.
(Currently shows "coming soon" toast — placeholder for future implementation.)
**Test:** Open project → 3-dots menu → verify "ייצא פרויקט" option appears.

---

## Other Changes
- **Playwright removed:** E2E test files and config removed (caused build failures, not needed for now)
- **New file:** `lib/format-date.ts` — shared date formatting utility
- **New file:** `PLAN.md` — action plan document
- **Pre-existing changes on branch:** Script workspace row actions, sort_index ordering, source text editing
