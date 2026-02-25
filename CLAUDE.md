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
| Data fetching | SWR + useSWRInfinite (cursor pagination) |
| Package manager | pnpm |
| Tests | Vitest — `pnpm test` (77 tests) |

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
    index.ts               # Pipeline
    __tests__/             # 77 unit tests
  projects/api.ts          # Projects data (USE_MOCKS = false)

components/
  actor-card.tsx           # כרטיס שחקן (shuffle, favorite, folder)
  actor-edit-form.tsx      # עריכת שחקן
  date-input.tsx           # קומפוננטת תאריך dd/mm/yyyy
  projects/
    roles-tab.tsx                  # ניהול תפקידים
    scripts-tab.tsx                # תסריטים + parsing
    script-workspace-tab.tsx       # מודול 4 — טבלת שורות + עריכה inline + צבעי תפקידים + סינון
    script-lines-import-dialog.tsx # דיאלוג מיפוי עמודות Excel לפני ייבוא שורות

migrations/
  002_fix_schema_gaps.sql        # רץ בהצלחה — skills/languages TEXT[]→JSONB
  003_multi_actor_per_role.sql   # רץ בהצלחה — UNIQUE(role_id)→UNIQUE(role_id,actor_id)
  004_script_lines.sql           # רץ בהצלחה — טבלת script_lines (ראה §6)
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
| `casting_project_scripts` | תסריטים מעובדים |
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
- `casting_project_scripts` (לא `project_scripts`)
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
| PROJECTS-2 | עריכת פרויקט לא שמרה | תוקן יחד עם RLS fix |
| PROJECTS-4 | פורמט תאריך | נוצרה קומפוננטת `date-input.tsx` עם פורמט dd/mm/yyyy (חלקי — חסר calendar picker) |

### עדיין פתוחים — קריטי

| ID | מיקום | תיאור |
| --- | --- | --- |
| FOLDERS-1 | `app/folders/page.tsx` | אי אפשר ליצור תיקייה (UI קיים, פונקציה שבורה) |

### עדיין פתוחים — גבוה

| ID | מיקום | תיאור |
| --- | --- | --- |
| ACTORS-1 | `app/page.tsx` | שאפל לא כולל שחקנים שנוספו דרך הטופס |
| ACTORS-2 | `components/actor-card.tsx` | כפתורי "שיוך לתיקייה" ו"מועדפים" לא עובדים |
| ADMIN-2 | `lib/actions/submission-actions.ts` | מיזוג שחקן קיים — לא מוגדר, צריך החלטת עיצוב |
| PROJECTS-3 | `projects/[id]/page.tsx` | שם שחקן לא מופיע ליד תפקיד (כתוב "לא משובץ") |
| SCRIPTS-1 | `components/projects/scripts-tab.tsx` | טעינת קבצים מחזירה שגיאות — לבדוק end-to-end עם parser |

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
| 1 | **Actors** — מאגר שחקנים גלובלי | ✅ פועל (עם באגים פתוחים) |
| 2 | **Casting Projects** — פרויקטים, תפקידים, שיבוץ | ✅ פועל (RLS תוקן, multi-actor תוקן) |
| 3 | **Script Intelligence** — העלאה, חילוץ תפקידים, parser | 🟡 חלקי |
| 4 | **Script Workspace** — מחליף את האקסל | ✅ הושלם בבראנצ' claude (מוזג חלקית ל-v0) |

### מודול 4 — Script Workspace

**DB:** טבלת `script_lines` קיימת ופעילה (migration 004/025).
**UI:** טאב "סביבת עבודה" בדף פרויקט (`script-workspace-tab.tsx`).
**טיפוסים:** `ScriptLine`, `ScriptLineInput`, `RecStatus` — מוגדרים ב-`lib/types.ts`.

**מה הושלם (בבראנצ' claude/add-script-handling-IH2JC):**
- ייבוא Excel עם auto-detect עמודות + מיפוי ידני
- טבלת שורות עם עריכה inline (תרגום, rec_status, הערות)
- צבעי תפקידים אוטומטיים
- סינון לפי תפקיד ו-rec_status
- שמירה ב-DB (batch של 500 בכל פעם)
- actor_id בכל שורה — מוכן לשיוך מה-casting

**חסר עדיין (לפיתוח עתידי):**
- ייצוא Excel
- שיוך שחקן אוטומטי מה-casting (actor_id נשמר אבל UI לא מציג את שם השחקן מה-casting)
- עריכת timecode inline

### שלבי עבודה

| שלב | ברנץ' | סטטוס |
| --- | --- | --- |
| א | `claude/fix-known-bugs` | 🟡 חלק תוקן, חלק פתוח (ראה §7) |
| ב | `claude/fix-ux-consistency` | 🔴 טרם התחיל |
| ג | `claude/add-script-handling-IH2JC` | ✅ הושלם — מוזג ל-v0 branch (קונפליקטים נפתרו) |

### מיזוג claude → v0
**קונפליקטים שנפתרו:**
- `lib/types.ts` — נשמרו `castings: RoleCasting[]` מ-v0 + `ScriptLine`/`RecStatus`/`ScriptLineInput` מ-claude
- `app/projects/[id]/page.tsx` — נשמר `grid-cols-4` מ-v0 + טאב "סביבת עבודה" + `ScriptWorkspaceTab` import מ-claude

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

### כלי פיתוח
- **Claude Code** — לוגיקה, TypeScript, DB, bug fixes
- **v0.app** — styling, UI, DB schema fixes, מיזוגים

### ברנץ'ים
- שם: `[agent]/[תיאור]`
- merge רק דרך PR
- לא לדחוף ישירות ל-`main`
- v0 branch נוכחי: `v0/amit-2370-1641a336`
