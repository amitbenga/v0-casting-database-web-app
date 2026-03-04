# CLAUDE.md — Casting Database Web App

> קובץ זה נקרא אוטומטית על ידי Claude Code בתחילת כל סשן.
> הוא מכיל את כל ההקשר שסוכן חדש צריך כדי להתחיל לעבוד מיידית.

---

## 1. מהי האפליקציה

**מערכת ניהול ליהוק לאולפן דיבוב** — Next.js 16 (App Router) + Supabase (PostgreSQL).

**חזון עתידי:** האפליקציה תהפוך ממערכת ליהוק למנוע עבודה מלא לאולפן דיבוב — כולל ניהול תרגום, טיימקודים, וסטטוסי הקלטה (ראה §8 רודמאפ).

**GitHub:** `https://github.com/amitbenga/v0-casting-database-web-app`

---

## 2. מבנה ספריות (git worktrees)

```
C:\Users\Amit\CASTING-APP\
  ├── main\              ← ריפו ראשי (branch: main)
  ├── claude\[שם]\       ← worktree לבראנץ' של Claude
  └── [agent]\[שם]\     ← worktrees לסוכנים אחרים
```

**ליצירת worktree חדש לבראנץ' חדש:**
```bash
cd "C:\Users\Amit\CASTING-APP\main"
git worktree add "..\claude\fix-known-bugs" -b claude/fix-known-bugs
# ואז לפתוח VSCode בתיקייה החדשה
```

**כלל שמות ברנץ'ים:** `[agent]/[תיאור]`
- `claude/fix-known-bugs`, `claude/script-workspace`
- `v0/ui-redesign`

---

## 3. טכנולוגיות

| שכבה | טכנולוגיה |
| --- | --- |
| Framework | Next.js 16 App Router |
| Language | TypeScript (0 errors חובה) |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| UI | shadcn/ui + Tailwind CSS |
| Data fetching | SWR + useSWRInfinite (cursor pagination) + SWR key factory |
| Package manager | pnpm |
| Tests | Vitest — `pnpm test` (300+ tests) |
| Validation | Zod — runtime schema validation in parser pipeline |

---

## 4. ארכיטקטורה — שני ריפויים, DB אחד

```
[scprodub repo]           [this repo]
 Public intake form  →   Admin + Casting management
 actor_submissions   ←→  actors, casting_projects, ...
       └─────── Same Supabase project ────────┘
```

**זרימת נתוני שחקנים:**
```
scprodub form → actor_submissions (Hebrew strings, raw_payload JSON)
    → app/admin/page.tsx (admin review + approve)
    → actors table ({id, key, label} objects)
```

**הטופס הציבורי (scprodub) = Source of Truth לשדות השחקן.**
כל שינוי בשדות עריכת שחקן חייב להיות תואם לאפשרויות בטופס.

---

## 5. קבצים מפתח

```
app/
  page.tsx                 # Actor list — cursor pagination + filters
  admin/page.tsx           # Approve/reject submissions
  intake/page.tsx          # Internal intake (VAT: ptor/murshe/artist_salary)
  actors/[id]/page.tsx     # Actor profile
  projects/page.tsx        # Projects list
  projects/[id]/page.tsx   # Project detail (roles, actors, scripts, workspace)
  folders/page.tsx         # Folders

lib/
  types.ts                 # כל הטיפוסים (source of truth)
                           # כולל: RecStatus, ScriptLine, ScriptLineInput
  actions/
    submission-actions.ts  # Admin approve/reject + merge
    casting-actions.ts     # Role casting
    script-actions.ts      # Script upload + processing
    script-line-actions.ts # Script Workspace CRUD:
                           #   saveScriptLines(projectId, lines, options)
                           #   getScriptLines(projectId, filters)
                           #   updateScriptLine(lineId, updates)
                           #   deleteAllScriptLines(projectId)
                           #   getScriptRoles(projectId)
  parser/
    script-parser.ts       # Parser מודרגש (פב 2026)
    excel-parser.ts        # 2 חלקים:
                           #   (1) parseExcelFile / applyExcelMapping → תפקידים מ-Excel
                           #   (2) parseScriptLinesFromExcel / autoDetectScriptLineColumns → שורות לסביבת עבודה
    fuzzy-matcher.ts
    index.ts               # Pipeline ראשי — parseScriptFiles(), applyUserEdits(), convertToDbFormat()
    text-extractor.ts      # חילוץ טקסט מ-PDF/DOCX/TXT + טבלות מ-PDF (x-coordinate clustering)
    structured-parser.ts   # פרסר טבלאי גנרי — StructuredParseResult → ScriptLineInput[]
                           #   autoDetectColumns(), parseScriptLinesFromStructuredData()
                           #   extractDialogueLines() — screenplay חופשי
    content-detector.ts    # זיהוי סוג תוכן: "tabular" | "screenplay" | "hybrid"
    diagnostics.ts         # מודול diagnostics מובנה — DiagnosticSeverity, DiagnosticCollector
    schemas.ts             # Zod schemas לvalidation בכל ה-pipeline
    tokenizer.ts           # Tokenizer קל לסקרינפליי — CHARACTER/DIALOGUE/ACTION/etc.
    __tests__/             # 300+ unit tests (10 קבצי בדיקה)
  projects/api.ts          # Projects data (USE_MOCKS = false)

components/
  actor-card.tsx           # כרטיס שחקן (shuffle, favorite, folder)
  actor-edit-form.tsx      # עריכת שחקן
  date-input.tsx           # קומפוננטת תאריך dd/mm/yyyy
  projects/
    roles-tab.tsx                  # ניהול תפקידים
    role-casting-card.tsx          # כרטיס תפקיד + שיבוץ שחקן (ActorSearchAutocomplete)
    actor-search-autocomplete.tsx  # חיפוש שחקן autocomplete לשיבוץ
    actors-tab.tsx                 # טאב שחקנים בפרויקט — רשימה + ספירת רפליקות
    casting-workspace.tsx          # סביבת עבודה ליהוק — תצוגה משולבת
    scripts-tab.tsx                # תסריטים + parsing + preview dialogs
    excel-preview-dialog.tsx       # תצוגה מקדימה לקובץ Excel לפני parsing
    script-preview-dialog.tsx      # תצוגה מקדימה לתסריט מעובד
    script-workspace-tab.tsx       # מודול 4 — טבלת שורות + עריכה inline + צבעי תפקידים + סינון
                                   #   + ייצוא Excel RTL + בחירה מרובה + מחיקה bulk + pagination
    script-lines-import-dialog.tsx # דיאלוג מיפוי עמודות Excel לפני ייבוא שורות

migrations/
  002_fix_schema_gaps.sql        # רץ בהצלחה — skills/languages TEXT[]→JSONB
  003_multi_actor_per_role.sql   # רץ בהצלחה — UNIQUE(role_id)→UNIQUE(role_id,actor_id)
  004_script_lines.sql           # רץ בהצלחה — טבלת script_lines (ראה §6)

lib/actions/
  submission-actions.ts  # Admin approve/reject + merge
  casting-actions.ts     # Role casting + searchActors() + getProjectActorsFromCastings()
  script-actions.ts      # Script upload + processing
  script-line-actions.ts # Script Workspace CRUD (saveScriptLines, getScriptLines, ...)
  script-processing.ts   # עיבוד תסריטים — parseAndSaveScript()
  folder-actions.ts      # Server Actions לתיקיות — createFolder() (תוקן: FOLDERS-1)
```

---

## 6. מצב DB (אחרי migrations 002-003 + scripts 017-025, פב 2026)

### טבלאות
| טבלה | הערות |
| --- | --- |
| `actors` | skills/languages = JSONB `[{id,key,label}]`, id = text |
| `actor_submissions` | בקשות מטופס חיצוני, review_status = pending/approved/rejected |
| `casting_projects` | כולל director, casting_director, project_date (נוספו ב-017) |
| `project_roles` | תפקידים בפרויקט |
| `role_castings` | UNIQUE(role_id, actor_id) — מרובי שחקנים לתפקיד (003) |
| `project_scripts` | תסריטים מעובדים |
| `script_lines` | שורות סקריפט לסביבת עבודה (025) — ראה פרטים מלאים למטה |
| `folders` / `folder_actors` | תיקיות שחקנים |
| `user_profiles` | פרופילי admin (018) |

### script_lines — עמודות מלאות
```
id            TEXT PK (gen_random_uuid()::text)
project_id    TEXT NOT NULL → FK casting_projects(id) ON DELETE CASCADE
script_id     TEXT (nullable — מקשר לקובץ תסריט, לא חובה)
line_number   INTEGER
timecode      TEXT (פורמט HH:MM:SS:FF או HH:MM:SS)
role_name     TEXT NOT NULL (שם הדמות כמו שמופיע בתסריט)
actor_id      TEXT → FK actors(id) ON DELETE SET NULL (nullable)
source_text   TEXT (טקסט מקור — אנגלית/צרפתית וכו')
translation   TEXT (תרגום לעברית — עריכה inline)
rec_status    TEXT — 'הוקלט' | 'Optional' | 'לא הוקלט' | NULL (= pending)
notes         TEXT
created_at    TIMESTAMPTZ DEFAULT NOW()
```
**אינדקסים:** project_id, (project_id, role_name), (project_id, line_number), actor_id

### טיפוס RecStatus (lib/types.ts)
`RecStatus = "הוקלט" | "Optional" | "לא הוקלט"`

### שמות שדות חשובים (לא להתבלבל)
- `folder_actors` (לא `actor_folders`)
- `project_scripts` (לא `project_scripts`)
- `script_casting_warnings` → `role_1_name`/`role_2_name` (לא `role_id_a`/`role_id_b`)
- `actors.vat_status` → `"ptor"` | `"murshe"` | `"artist_salary"`

### RLS — גישה ציבורית (זמני)
**כל הטבלאות** מוגדרות כרגע עם `USING (true)` / `WITH CHECK (true)` לכל הפעולות.
**סיבה:** האפליקציה מנהלת auth ברמת ה-AuthContext (לא דרך Supabase Auth), כך שכל הקריאות מגיעות כ-`anon` role.
**סטטוס:** לא הוחלט עדיין אם להוסיף Supabase Auth אמיתי בעתיד.

### Mock Mode
`USE_MOCKS = false` ב-`lib/projects/api.ts`

---

## 7. TODO — באגים ידועים

> **כלל:** קודם לסגור את כל הבאגים, אחר כך פיתוח חדש.
> **סטטוס:** חלק מהבאגים תוקנו (פב 2026), השאר בטיפול ידני של הצוות.

### תוקנו (פב 2026)

| ID | מה תוקן | איך |
| --- | --- | --- |
| ADMIN-1 | כפתור "אשר" לא עבד | RLS חסם — נוספו user_profiles (018) + policies פתוחות (019) |
| PROJECTS-1 | אי אפשר ליצור פרויקט | חסרו שדות director/casting_director/project_date ב-DB (017) + RLS |
| PROJECTS-2 | עריכת פרויקט לא שמרה | תוקן יחד עם RLS fix + explicit columns (no select('*')) |
| PROJECTS-4 | פורמט תאריך | נוצרה קומפוננטת `date-input.tsx` עם פורמט dd/mm/yyyy (חלקי — חסר calendar picker) |
| FOLDERS-1 | אי אפשר ליצור תיקייה | נוצר `lib/actions/folder-actions.ts` — Server Action במקום client call |
| ACTORS-1 | שאפל לא כולל שחקנים חדשים | `revalidateFirstPage: true` ב-SWR |
| ACTORS-2 | כפתור "מועדפים" לא עבד | כפתור מחובר ל-`handleAddToFolder` |
| PROJECTS-3 | שם שחקן לא הופיע | תוקן `getProjectRolesWithCasting` select לכלול שמות שחקנים |
| SCRIPTS-1 | טעינת קבצים מחזירה שגיאות | תוקן `project_scripts` → `project_scripts` (3 מיקומים) |

### עדיין פתוחים — גבוה

| ID | מיקום | תיאור |
| --- | --- | --- |
| ADMIN-2 | `lib/actions/submission-actions.ts` | מיזוג שחקן קיים — לא מוגדר, צריך החלטת עיצוב |

### עדיין פתוחים — בינוני (UX + ניקויים)

| ID | מיקום | תיאור |
| --- | --- | --- |
| ACTORS-3 | `app/page.tsx` | בבחירה מרובה — הסר אפשרות "הוסף לפרויקט" |
| ACTORS-4 | `components/actor-edit-form.tsx` | שדות חייבים להיות תואמים לטופס הציבורי (scprodub) |
| ADMIN-3 | `app/admin/page.tsx` | בקשות דחויות: הוסף "נקה הכל" + בחירה סלקטיבית |
| PROJECTS-4 | תאריכים בכל הפרויקטים | calendar picker עם ניווט שנים (קומפוננטת dd/mm/yyyy קיימת) |
| PROJECTS-5 | יצירה + רשימה | סטטוסי פרויקט לא אחידים |
| ROLES-1 | `components/projects/roles-tab.tsx` | הסר אינדיקטור מקור תפקיד (ידני/תסריט) — מיותר |
| ROLES-2 | `components/projects/roles-tab.tsx` | הוסף "בחר הכל" לבחירה מרובה |

> **הערה:** הצוות עובד כרגע על דיבאגים ותיקוני UI קלים בעצמו. סוכנים אחרים — אל תיגעו בבאגים הפתוחים בלי תיאום.

---

## 8. חזון ורודמאפ

### המצב הקיים
האקסל הוא כלי העבודה העיקרי לניהול דיבוב (רפליקות, טיימקודים, תרגומים).
האפליקציה מנהלת **ליהוק בלבד** — ללא חיבור לעבודת התסריט.

### היעד
```
היום:  ליהוק (app) + עבודת תסריט (Excel) = שתי מערכות נפרדות
יעד:   ליהוק + עבודת תסריט = מערכת אחת — האקסל הופך ל-Output בלבד
```

### 4 מודולים

| # | מודול | סטטוס |
| --- | --- | --- |
| 1 | **Actors** — מאגר שחקנים גלובלי | ✅ פועל (רוב הבאגים תוקנו) |
| 2 | **Casting Projects** — פרויקטים, תפקידים, שיבוץ | ✅ פועל (RLS תוקן, multi-actor תוקן) |
| 3 | **Script Intelligence** — העלאה, חילוץ תפקידים, parser | 🟡 מתקדם (PDF/DOCX tabular תמיכה חלקית) |
| 4 | **Script Workspace** — מחליף את האקסל | ✅ הושלם ומוזג ל-main |

### מודול 4 — Script Workspace

**DB:** טבלת `script_lines` קיימת ופעילה (migration 004/025).
**UI:** טאב "סביבת עבודה" בדף פרויקט (`script-workspace-tab.tsx`).
**טיפוסים:** `ScriptLine`, `ScriptLineInput`, `RecStatus` — מוגדרים ב-`lib/types.ts`.

**מה הושלם (מוזג ל-main):**
- ייבוא Excel עם auto-detect עמודות + מיפוי ידני
- טבלת שורות עם עריכה inline (תרגום, rec_status, הערות)
- צבעי תפקידים אוטומטיים
- סינון לפי תפקיד ו-rec_status
- שמירה ב-DB (batch של 500 בכל פעם)
- actor_id בכל שורה + שיוך אוטומטי מה-casting
- **ייצוא Excel RTL** — כותרות מודגשות, freeze pane, auto-filter, 8 עמודות כולל שם שחקן
- בחירה מרובה של שורות + מחיקה bulk
- Pagination
- ספירת רפליקות לפי שחקן

**חסר עדיין (לפיתוח עתידי):**
- עריכת timecode inline
- תמיכה מלאה ב-PDF/DOCX לייבוא שורות (tabular extraction קיים, UI עדיין מבוסס Excel)

### מודול 3 — Script Intelligence (Parser)

**ארכיטקטורה (פב 2026):**
```
קובץ נכנס (Excel/PDF/DOCX/TXT)
    ↓
detectContentType() → "tabular" | "screenplay" | "hybrid"
    ↓
┌─ tabular ──→ extractStructuredData() → StructuredParseResult
│                  ↓ autoDetectColumns() + parseScriptLinesFromStructuredData()
└─ screenplay ─→ tokenizer → extractDialogueLines() → ScriptLineInput[]
    ↓
diagnostics + Zod validation → ScriptLineInput[] לDB
```

**מודולים שנוספו (claude/enhance-file-parser-C8JeT):**
- `content-detector.ts` — זיהוי tabular/screenplay/hybrid
- `structured-parser.ts` — פרסר גנרי לכל מקור טבלאי
- `tokenizer.ts` — tokenizer מובנה לסקרינפליי
- `diagnostics.ts` — structured diagnostics לכל שלב ב-pipeline
- `schemas.ts` — Zod validation לכל הטיפוסים
- `text-extractor.ts` — שודרג לתמיכה ב-PDF column clustering + DOCX tables

**סטטוס תמיכה בפורמטים:**
| פעולה | Excel | PDF | DOCX | TXT |
| --- | --- | --- | --- | --- |
| חילוץ תפקידים | ✅ | ✅ | ✅ | ✅ |
| שורות לסביבת ��בודה | ✅ מלא | 🟡 טבלאי חלקי | 🟡 טבלאי חלקי | 🟡 NAME: format |

### שלבי עבודה

| שלב | ברנץ' | סטטוס |
| --- | --- | --- |
| א | `claude/fix-known-bugs` | ✅ הושלם — רוב הבאגים תוקנו ומוזגו ל-main |
| ב | `claude/fix-ux-consistency` | 🔴 טרם התחיל |
| ג | `claude/add-script-handling-IH2JC` | ✅ הושלם — מוזג ל-main |
| ד | `claude/improve-model-4-workspace-C8vDl` | ✅ הושלם — ייצוא Excel, auto-assign, bulk delete, pagination |
| ה | `claude/enhance-file-parser-C8JeT` | ✅ הושלם — PDF/DOCX tabular support, Zod validation, diagnostics |
| ו | `claude/improve-app-performance-y2wVC` | ✅ הושלם — ביצועים (מרץ 2026) |

### שלב ו — Performance Improvements (מרץ 2026)

**מה הושלם:**
- **SWR caching** — כל הדפים (actors, projects, folders, actor detail) משתמשים ב-SWR עם:
  - Global SWRConfig: `revalidateOnFocus: false`, `dedupingInterval: 30000`, `keepPreviousData: true`
  - SWR Key Factory (`lib/swr-keys.ts`) — centralized cache keys
  - keepPreviousData guards — מניעת flash של entity ישן בניווט בין detail pages
  - Optimistic updates עם rollback (save previousData, restore on error)
- **Skeleton loading** — כל 8 ה-loading.tsx files מציגים skeleton UI (לא null/spinner)
- **Navigation prefetching** — `<Link>` במקום `router.push`/`window.location.href` (כולל ActorCard)
- **Auth optimization** — Supabase client singleton + profile cache ב-memory (cleared on logout)
- **Dynamic imports** — 4 טאבים בדף פרויקט נטענים lazy (CastingWorkspace, ScriptsTab, ActorsTab, ScriptWorkspaceTab)
- **Payload optimization** — `select("*")` הוחלף בשדות ספציפיים בclient fetchers
- **SWRProvider** — `components/swr-provider.tsx` עוטף את כל האפליקציה

**קבצים חדשים:**
- `lib/swr-keys.ts` — SWR key factory
- `components/swr-provider.tsx` — Global SWR config
- `app/actors/[id]/loading.tsx` — Actor detail skeleton
- `app/admin/loading.tsx` — Admin page skeleton

**DB optimization plan (מוכן ליישום):**
- אינדקסים: `idx_actors_full_name_trgm`, `idx_role_castings_actor_id`, `idx_script_lines_project_role`
- View: `project_summary` (מרכז project+roles+actors+scripts count ב-query אחד)
- Payload: narrow select בServer Actions (עדיין select("*") בחלקם)

---

## 9. כללי עבודה

### לפני כל push
```bash
pnpm exec tsc --noEmit   # חייב: 0 שגיאות
pnpm test                # חייב: כל הטסטים עוברים
```

### TypeScript
- `lib/types.ts` = source of truth לכל הטיפוסים
- הימנע מ-`any`
- `actors.id` הוא `text`, לא UUID

### Supabase
- תמיד `createClient()` / `createBrowserClient()` מהקונטקסט
- לא `select('*')` — ציין שדות
- כל mutations דרך Server Actions ב-`lib/actions/`
- **RLS כרגע פתוח (public)** — אל תניח שיש authenticated user
- כל מיגרציה חדשה חייבת לכלול RLS policies עם `USING (true)`

### DB Migrations
- מיגרציות חדשות בתיקיית `migrations/` (סדרתי: 002, 003, 004...)
- סקריפטים ישנים בתיקיית `scripts/` (017-025) — כבר הורצו, לא לשנות
- **חובה:** תיעוד כל מיגרציה ב-`docs/changes/`
- **חובה:** לבדוק שינויים מול הטופס הציבורי (scprodub) — כל שדה ב-actors/submissions חייב להתאים

### תלויות חשובות
- `xlsx` (SheetJS) — לקריאת קבצי Excel client-side (דינמי import בתוך `parseExcelFile`)
- `zod` — runtime validation ב-parser pipeline (`lib/parser/schemas.ts`)

### כלי פיתוח
- **Claude Code** — לוגיקה, TypeScript, DB, bug fixes
- **v0.app** — styling, UI, DB schema fixes, מיזוגים

### ברנץ'ים
- שם: `[agent]/[תיאור]`
- merge רק דרך PR
- לא לדחוף ישירות ל-`main`
- v0 branch נוכחי: `v0/amit-2370-8b365cde`
