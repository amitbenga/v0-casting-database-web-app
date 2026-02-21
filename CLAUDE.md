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
  projects/[id]/page.tsx   # Project detail (roles, actors, scripts)
  folders/page.tsx         # Folders

lib/
  types.ts                 # כל הטיפוסים (source of truth)
  actions/
    submission-actions.ts  # Admin approve/reject + merge
    casting-actions.ts     # Role casting
    script-actions.ts      # Script upload + processing
  parser/
    script-parser.ts       # Parser מודרגש (פב 2026)
    fuzzy-matcher.ts
    index.ts               # Pipeline
    __tests__/             # 77 unit tests
  projects/api.ts          # Projects data (USE_MOCKS = false)

components/
  actor-card.tsx           # כרטיס שחקן (shuffle, favorite, folder)
  actor-edit-form.tsx      # עריכת שחקן
  projects/
    roles-tab.tsx                    # ניהול תפקידים
    scripts-tab.tsx                  # תסריטים + parsing
    script-workspace-tab.tsx         # סביבת עבודה — Module 4
    script-lines-import-dialog.tsx   # דיאלוג ייבוא Excel לסביבת עבודה

lib/actions/
  script-line-actions.ts  # CRUD לשורות תסריט (saveScriptLines, getScriptLines, updateScriptLine)

migrations/
  002_fix_schema_gaps.sql         # רץ בהצלחה — skills/languages TEXT[]→JSONB
  003_multi_actor_per_role.sql    # מ-v0 — מאפשר כמה שחקנים לתפקיד
  004_script_lines.sql            # Module 4 — טבלת שורות תסריט
```

---

## 6. מצב DB (אחרי migrations 002–004, פב 2026)

- `actors.skills` / `actors.languages` → **JSONB**: `[{ id, key, label }]`
- `actors.vat_status` → `"ptor"` | `"murshe"` | `"artist_salary"`
- `actors.id` → `text` (לא UUID)
- `casting_projects.id` → `text`
- `folder_actors` (לא `actor_folders`)
- `casting_project_scripts` (לא `project_scripts`)
- `script_casting_warnings` → `role_1_name`/`role_2_name` (לא `role_id_a`/`role_id_b`)
- **Mock Mode: `USE_MOCKS = false`** ב-`lib/projects/api.ts`
- `role_castings` → constraint השתנה: מאפשר **כמה שחקנים לאותו תפקיד** (unique על `role_id, actor_id`)
- `script_lines` → **טבלה חדשה** (migration 004): שורות תסריט לסביבת עבודה
  - עמודות: `id, project_id, script_id, line_number, timecode, role_name, actor_id, source_text, translation, rec_status, notes`
  - `actor_id` → FK ל-`actors.id` — השחקן שמקליט את השורה

### סדר הרצת migrations ב-Supabase (חדש)
```
003_multi_actor_per_role.sql  ← קודם (מ-v0/amit-2370-1641a336)
004_script_lines.sql          ← אחר כך (מ-claude/add-script-handling-IH2JC)
```

---

## 7. TODO — באגים ידועים

> **כלל:** קודם לסגור את כל הבאגים, אחר כך פיתוח חדש.
> **ברנץ' הבא:** `claude/fix-known-bugs`

### 🔴 קריטי

| ID | מיקום | תיאור |
| --- | --- | --- |
| ADMIN-1 | `app/admin/page.tsx` → `handleApprove()` | כפתור "אשר" לא מוסיף שחקן ל-`actors` |
| FOLDERS-1 | `app/folders/page.tsx` | אי אפשר ליצור תיקייה (UI קיים, פונקציה שבורה) |
| PROJECTS-1 | `components/create-project-dialog.tsx` | אי אפשר ליצור פרויקט חדש |
| PROJECTS-2 | `app/projects/[id]/page.tsx` | עריכת פרויקט לא שומרת שינויים |

### 🟠 גבוה

| ID | מיקום | תיאור |
| --- | --- | --- |
| ACTORS-1 | `app/page.tsx` | שאפל לא כולל שחקנים שנוספו דרך הטופס |
| ACTORS-2 | `components/actor-card.tsx` | כפתורי "שיוך לתיקייה" ו"מועדפים" לא עובדים |
| ADMIN-2 | `lib/actions/submission-actions.ts` | מיזוג שחקן קיים — לא מוגדר, צריך החלטת עיצוב |
| PROJECTS-3 | `projects/[id]/page.tsx` | שם שחקן לא מופיע ליד תפקיד (כתוב "לא משובץ") |
| SCRIPTS-1 | `components/projects/scripts-tab.tsx` | טעינת קבצים מחזירה שגיאות — לבדוק end-to-end עם parser |

### 🟡 בינוני (UX + ניקויים)

| ID | מיקום | תיאור |
| --- | --- | --- |
| ACTORS-3 | `app/page.tsx` | בבחירה מרובה — הסר אפשרות "הוסף לפרויקט" |
| ACTORS-4 | `components/actor-edit-form.tsx` | שדות חייבים להיות תואמים לטופס הציבורי (scprodub) |
| ADMIN-3 | `app/admin/page.tsx` | בקשות דחויות: הוסף "נקה הכל" + בחירה סלקטיבית |
| PROJECTS-4 | תאריכים בכל הפרויקטים | פורמט צריך להיות `DD/MM/YYYY`, קלנדר עם ניווט שנים |
| PROJECTS-5 | יצירה + רשימה | סטטוסי פרויקט לא אחידים |
| ROLES-1 | `components/projects/roles-tab.tsx` | הסר אינדיקטור מקור תפקיד (ידני/תסריט) — מיותר |
| ROLES-2 | `components/projects/roles-tab.tsx` | הוסף "בחר הכל" לבחירה מרובה |

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
| 1 | **Actors** — מאגר שחקנים גלובלי | ✅ פועל (עם באגים) |
| 2 | **Casting Projects** — פרויקטים, תפקידים, שיבוץ | 🟡 חלקי |
| 3 | **Script Intelligence** — העלאה, חילוץ תפקידים, parser | 🟡 חלקי |
| 4 | **Script Workspace** — מחליף את האקסל | 🟡 חלקי (ייבוא + עריכה, חסר שיוך שחקן מה-casting) |

### מודול 4 — Script Workspace (היעד הבא אחרי סגירת באגים)

יחידת עבודה בסיסית: **שורת תסריט (רפליקה)**

כל שורה תכיל: Timecode · תפקיד · שחקן משובץ · טקסט מקור · תרגום טיוטה · תרגום מאושר · סטטוס · הערות

**פונקציות שעוברות מהאקסל:**
- הצגת timecodes לצד טקסט
- עריכת תרגום inline
- סינון לפי תפקיד/שחקן
- הדגשת שורות לפי תפקיד
- ספירת רפליקות
- ייצוא Excel (output בלבד)

### שלבי עבודה

| שלב | ברנץ' | תיאור | סטטוס |
| --- | --- | --- | --- |
| א | `claude/fix-known-bugs` | סגירת כל הבאגים הקריטיים והגבוהים | ⏳ ממתין |
| ב | `claude/fix-ux-consistency` | ניקויי UX + מיזוג שחקן קיים | ⏳ ממתין |
| ג | `claude/add-script-handling-IH2JC` | Module 4 — Script Workspace (ייבוא Excel, עריכה inline, עמודת שחקן) | 🟡 בפיתוח — ממתין למיזוג ל-v0/amit-2370-1641a336 |

### מיזוג `claude/add-script-handling-IH2JC` → `v0/amit-2370-1641a336`
בזמן ה-PR יהיו קונפליקטים ב-2 קבצים — לפתור ידנית:
- `lib/types.ts`: לקבל `castings: RoleCasting[]` של v0 + להחזיר ScriptLine/RecStatus
- `app/projects/[id]/page.tsx`: להחזיר `grid-cols-4` + טאב "סביבת עבודה"

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
- תמיד `createClient()` מהקונטקסט
- לא `select('*')` — ציין שדות
- כל mutations דרך Server Actions ב-`lib/actions/`

### כלי פיתוח
- **Claude Code** — לוגיקה, TypeScript, DB, bug fixes
- **v0.app** — styling ו-UI בלבד, לא לוגיקה

### ברנץ'ים
- שם: `[agent]/[תיאור]`
- merge רק דרך PR
- לא לדחוף ישירות ל-`main`
