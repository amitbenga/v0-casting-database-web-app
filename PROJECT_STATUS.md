# PROJECT_STATUS.md — Casting Database Web App
> **מסמך זה הוא נקודת הכניסה לכל סוכן או מתכנת חדש.**  
> עדכן אותו לאחר כל מיזוג משמעותי. תאריך עדכון אחרון: **מרץ 2026 (v0 session — AI parser + performance)**

---

## 📌 מה האפליקציה

**מערכת ניהול ליהוק לאולפן דיבוב** — Next.js 16 (App Router) + Supabase (PostgreSQL).

**GitHub:** `https://github.com/amitbenga/v0-casting-database-web-app`  
**Branch נוכחי (v0):** `v0/amit-2370-82e45604`  
**Branch ראשי:** `main`

**חזון:** האפליקציה תהפוך ממערכת ליהוק למנוע עבודה מלא לאולפן דיבוב — כולל ניהול תרגום, טיימקודים, וסטטוסי הקלטה.

---

## 🗺️ ארכיטקטורה כללית

```
[scprodub repo — ציבורי]       [this repo — admin]
   טופס קבלת שחקנים    →      ניהול ליהוק + DB admin
   actor_submissions   ←→     actors, casting_projects, ...
          └────────── אותו Supabase project ──────────┘
```

**Stack:**
| שכבה | טכנולוגיה |
|------|-----------|
| Framework | Next.js 16 App Router |
| Language | TypeScript (0 errors חובה) |
| Backend/DB | Supabase (PostgreSQL + Auth + Storage) |
| UI | shadcn/ui + Tailwind CSS |
| Data fetching | SWR + useSWRInfinite (cursor pagination) |
| Package manager | pnpm |
| Tests | Vitest — `pnpm test` (300+ tests) |
| Validation | Zod — runtime schema validation ב-parser pipeline |
| Excel | SheetJS (`xlsx`) |
| PDF | pdfjs-dist |

---

## 📁 מבנה ספריות

```
/
├── app/
│   ├── page.tsx                  # Actor list — cursor pagination + filters
│   ├── admin/page.tsx            # Approve/reject submissions
│   ├── intake/page.tsx           # Internal intake form
│   ├── login/page.tsx            # Login page
│   ├── actors/[id]/page.tsx      # Actor profile
│   ├── projects/page.tsx         # Projects list
│   ├── projects/[id]/page.tsx    # Project detail (roles/actors/scripts/workspace tabs)
│   └── folders/page.tsx          # Folders
│
├── components/
│   ├── actor-card.tsx
│   ├── actor-edit-form.tsx
│   ├── app-header.tsx
│   ├── filter-panel.tsx
│   ├── create-project-dialog.tsx
│   ├── edit-project-dialog.tsx
│   ├── create-folder-dialog.tsx
│   ├── create-role-dialog.tsx
│   ├── add-actor-to-folder-dialog.tsx
│   ├── add-actor-to-project-dialog.tsx
│   ├── select-folder-dialog.tsx
│   ├── project-role-card.tsx
│   └── projects/
│       ├── roles-tab.tsx                    # ניהול תפקידים
│       ├── role-casting-card.tsx            # כרטיס תפקיד + שיבוץ שחקן
│       ├── actor-search-autocomplete.tsx    # חיפוש אוטומטי לשיבוץ
│       ├── actors-tab.tsx                   # טאב שחקנים + ספירת רפליקות
│       ├── casting-workspace.tsx            # תצוגה משולבת
│       ├── scripts-tab.tsx                  # תסריטים + parsing + preview
│       ├── excel-preview-dialog.tsx         # תצוגה מקדימה Excel
│       ├── script-preview-dialog.tsx        # תצוגה מקדימה תסריט
│       ├── script-workspace-tab.tsx         # ⭐ Module 4 — שורות + עריכה inline + ייצוא
│       └── script-lines-import-dialog.tsx   # דיאלוג מיפוי עמודות Excel לייבוא
│
├── lib/
│   ├── types.ts                   # Source of truth לכל הטיפוסים
│   ├── utils.ts
│   ├── store.ts
│   ├── mock-data.ts
│   ├── export-utils.ts
│   ├── casting-export-import.ts
│   ├── normalizers.ts
│   ├── actions/
│   │   ├── submission-actions.ts  # Admin approve/reject + merge
│   │   ├── casting-actions.ts     # Role casting + searchActors
│   │   ├── script-actions.ts      # Script upload + processing
│   │   ├── script-line-actions.ts # Script Workspace CRUD
│   │   ├── script-processing.ts   # parseAndSaveScript()
│   │   └── folder-actions.ts      # createFolder()
│   ├── parser/
│   │   ├── index.ts               # Pipeline ראשי
│   │   ├── script-parser.ts       # Parser regex
│   │   ├── excel-parser.ts        # Excel → roles + script lines
│   │   ├── structured-parser.ts   # פרסר טבלאי גנרי
│   │   ├── content-detector.ts    # זיהוי tabular/screenplay/hybrid
│   │   ├── text-extractor.ts      # חילוץ טקסט PDF/DOCX/TXT
│   │   ├── fuzzy-matcher.ts
│   │   ├── tokenizer.ts           # Tokenizer לסקרינפליי
│   │   ├── diagnostics.ts         # Structured diagnostics
│   │   ├── schemas.ts             # Zod schemas
│   │   └── __tests__/             # 300+ unit tests (10 קבצים)
│   ├── projects/
│   │   ├── api.ts                 # Projects data (USE_MOCKS = false)
│   │   └── types.ts
│   └── supabase/
│       ├── client.ts
│       └── server.ts
│
├── contexts/
│   └── AuthContext.tsx
│
├── docs/
│   ├── changes/                   # תיעוד כל שינוי משמעותי
│   └── decisions/                 # ADRs — החלטות ארכיטקטורה
│
├── migrations/                    # מיגרציות חדשות (002, 003, 004...)
├── scripts/                       # מיגרציות ישנות שכבר רצו (001–025)
│
├── CLAUDE.md                      # הקשר מלא לסוכני Claude — קרא ראשון!
├── plan.md                        # תוכנית מפורטת לשדרוג ה-parser
├── WORKFLOW.md                    # חלוקת אחריות Claude/v0
└── DEVELOPER_GUIDE.md             # מדריך מפתח מלא
```

---

## 🗄️ סכימת DB — מצב נוכחי (מרץ 2026)

### טבלאות פעילות
| טבלה | תיאור | הערות |
|------|-------|-------|
| `actors` | מאגר שחקנים | `skills`/`languages` = JSONB `[{id,key,label}]` |
| `actor_submissions` | בקשות מהטופס הציבורי | `review_status` = pending/approved/rejected |
| `casting_projects` | פרויקטים | כולל `director`, `casting_director`, `project_date` |
| `project_roles` | תפקידים בפרויקט | Source of Truth לרפליקות |
| `role_castings` | שיבוץ שחקן לתפקיד | `UNIQUE(role_id, actor_id)` — מרובי שחקנים |
| `project_scripts` | תסריטים מעובדים | |
| `script_lines` | שורות סקריפט לסביבת עבודה | migration 025 |
| `folders` / `folder_actors` | תיקיות שחקנים | |
| `user_profiles` | פרופילי admin | |

### script_lines — עמודות
```sql
id            TEXT PK (gen_random_uuid()::text)
project_id    TEXT NOT NULL → FK casting_projects(id) ON DELETE CASCADE
script_id     TEXT (nullable)
line_number   INTEGER
timecode      TEXT (HH:MM:SS:FF)
role_name     TEXT NOT NULL
actor_id      TEXT → FK actors(id) ON DELETE SET NULL
source_text   TEXT
translation   TEXT
rec_status    TEXT  -- 'הוקלט' | 'Optional' | 'לא הוקלט' | NULL
notes         TEXT
created_at    TIMESTAMPTZ DEFAULT NOW()
```

### RLS — גישה ציבורית (זמני)
כל הטבלאות: `USING (true)` / `WITH CHECK (true)`.  
**סיבה:** Auth מנוהל ברמת ה-`AuthContext`, לא דרך Supabase Auth.

### שמות שדות חשובים (לא להתבלבל!)
- `folder_actors` (לא `actor_folders`)
- `project_scripts` (לא `project_scripts`)
- `actors.vat_status` → `"ptor"` | `"murshe"` | `"artist_salary"`
- `actors.id` הוא `text`, לא UUID

---

## 🔄 היסטוריית קומיטים / מיזוגים עיקריים

### שלב א — תיקון באגים קריטיים (`claude/fix-known-bugs`)
**מוזג ל-main — פב 2026**

| מה | איך |
|----|-----|
| כפתור "אשר" לא עבד (ADMIN-1) | RLS חסם — נוספו `user_profiles` + policies פתוחות (scripts 018, 019) |
| יצירת פרויקט נכשלה (PROJECTS-1) | חסרו `director`/`casting_director`/`project_date` ב-DB (script 017) |
| עריכת פרויקט לא שמרה (PROJECTS-2) | תוקן יחד עם RLS fix |
| יצירת תיקייה נכשלה (FOLDERS-1) | נוצר `lib/actions/folder-actions.ts` — Server Action |
| שאפל לא כלל שחקנים חדשים (ACTORS-1) | `revalidateFirstPage: true` ב-SWR |
| שם שחקן לא הופיע בתפקיד (PROJECTS-3) | תוקן select ב-`getProjectRolesWithCasting` |
| `project_scripts` שגיאות (SCRIPTS-1) | תוקן ל-`project_scripts` ב-3 מיקומים |

### שלב ג — Script Handling (`claude/add-script-handling-IH2JC`)
**מוזג ל-main — פב 2026**

- העלאת תסריטים + parsing
- חילוץ תפקידים אוטומטי
- אחסון ב-`project_scripts`

### שלב ד — Script Workspace (`claude/improve-model-4-workspace-C8vDl`)
**מוזג ל-main — פב 2026**

| מה נוסף |
|---------|
| `script-workspace-tab.tsx` — טבלת שורות + עריכה inline |
| `script-lines-import-dialog.tsx` — מיפוי עמודות Excel |
| `lib/actions/script-line-actions.ts` — CRUD לשורות |
| ייצוא Excel RTL — כותרות מודגשות, freeze pane, 8 עמודות |
| בחירה מרובה + מחיקה bulk |
| Pagination |
| צבעי תפקידים אוטומטיים |
| שיוך אוטומטי `actor_id` מה-casting |

**מיגרציה שרצה:** `scripts/025_create_script_lines_table.sql`

### שלב ה — Parser Enhancements (`claude/enhance-file-parser-C8JeT`)
**מוזג ל-main — פב 2026**

| מה נוסף |
|---------|
| `content-detector.ts` — זיהוי tabular/screenplay/hybrid |
| `structured-parser.ts` — פרסר גנרי לכל מקור טבלאי |
| `tokenizer.ts` — Tokenizer לסקרינפליי |
| `diagnostics.ts` — Structured diagnostics |
| `schemas.ts` — Zod validation לכל ה-pipeline |
| `text-extractor.ts` — שודרג: PDF column clustering + DOCX tables |
| 300+ unit tests ב-10 קבצים |

### Migrations Sync (`v0/amit-2370-...` + CLAUDE)
**פב 2026**

| Migration | תיאור |
|-----------|-------|
| `migrations/002` | `skills`/`languages` TEXT[]→JSONB |
| `migrations/003` | `role_castings`: `UNIQUE(role_id)` → `UNIQUE(role_id, actor_id)` |
| `scripts/017` | הוספת `director`, `casting_director`, `project_date` ל-`casting_projects` |
| `scripts/018` | seed admin users ל-`user_profiles` |
| `scripts/019` | RLS fix — גישה ציבורית לכל הטבלאות |
| `scripts/025` | יצירת `script_lines` |

---

## 🟢 סטטוס מודולים

| # | מודול | סטטוס | הערות |
|---|-------|--------|-------|
| 1 | **Actors** — מאגר שחקנים גלובלי | ✅ פועל | רוב הבאגים תוקנו |
| 2 | **Casting Projects** — פרויקטים, תפקידים, שיבוץ | ✅ פועל | RLS תוקן, multi-actor תוקן |
| 3 | **Script Intelligence** — parser | 🟡 חלקי | Excel מלא, PDF/DOCX טבלאי חלקי |
| 4 | **Script Workspace** — מחליף את האקסל | ✅ הושלם ומוזג | ייבוא, עריכה, ייצוא, pagination |

### תמיכת פורמטים ב-Parser
| פעולה | Excel | PDF | DOCX | TXT |
|-------|-------|-----|------|-----|
| חילוץ תפקידים | ✅ | ✅ | ✅ | ✅ |
| שורות לסביבת עבודה | ✅ מלא | 🟡 טבלאי חלקי | 🟡 טבלאי חלקי | 🟡 NAME: format |

---

### תיקוני UX ו-UI של שלב Go-Live
**הושלמו ומוזגו ל-main — מבוסס על הסוכנים המקבילים**

| ID | מיקום | תיאור | סטטוס |
|----|--------|-------|-------|
| ADMIN-2 | `lib/actions/submission-actions.ts` | מיזוג שחקן קיים עם טופס | ✅ בוצע |
| ACTORS-3 | `app/page.tsx` | בחירה מרובה — הסר "הוסף לפרויקט" | ✅ בוצע |
| ADMIN-3 | `app/admin/page.tsx` | בקשות דחויות: "נקה הכל" | ✅ בוצע |
| PROJECTS-5 | יצירה + רשימה | סטטוסי פרויקט אחידים | ✅ בוצע |
| ROLES-1/2 | `components/projects/roles-tab.tsx` | בחירה מרובה ותצוגה | ✅ בוצע |
| EXCEL-1 | `components/projects/script-workspace-tab.tsx` | ייצוא פרויקט מלא וסביבת תסריט | ✅ בוצע |

> ⚠️ **לסוכנים:** האפליקציה כרגע במצב יציב מבחינת UI. יש להתמקד באופטימיזציית DB ו-Deployments.

> ⚠️ **לסוכנים:** אל תיגעו בבאגים הפתוחים בלי תיאום עם הצוות.

---

### בראנץ' הבא (אופטימיזציית DB + ייצור)
- **DB Indexes**: הרצת חבילת האינדקסים מתוך ה-ROADMAP (Migration 005)
- **RLS Policies**: הפעלת רמת בטיחות מינימלית
- **צמצום Select("*")**: שיפור בחירת נתונים ב-14 מיקומים
- **פריסה (Deployment)**: הגדרת Next.js Vercel ENV

### שיפורים עתידיים ל-UI ולפאסר (נמוך עדיפות):
- סטטוסי פרויקט משתנים בצורה אוטומטית מלאה
- OCR ל-PDF סרוק (חסר כרגע)

### חסר מה-UI (נמוך עדיפות):
- Auth אמיתי דרך Supabase Auth (כרגע הכל `anon` + AuthContext)
- `schema_migrations` tracking table
- Schema validation CI (TypeScript ↔ DB)

---

## ⚙️ כללי עבודה

### לפני כל push
```bash
pnpm exec tsc --noEmit   # חייב: 0 שגיאות
pnpm test                # חייב: כל הטסטים עוברים
pnpm run lint            # אין lint errors
```

### TypeScript
- `lib/types.ts` = **source of truth** לכל הטיפוסים
- אסור `any`
- `actors.id` הוא `text`, לא UUID

### Supabase
- לא `select('*')` — ציין שדות
- כל mutations דרך Server Actions ב-`lib/actions/`
- **RLS כרגע פתוח** — אל תניח שיש authenticated user
- כל מיגרציה חדשה: `migrations/NNN_name.sql` + תיעוד ב-`docs/changes/`

### חלוקת כלים
| כלי | תפקיד |
|-----|-------|
| **Claude Code** | לוגיקה, TypeScript, DB, Server Actions, parser, bug fixes |
| **v0.app** | UI styling, shadcn components, עיצוב, Tailwind |

> **כלל:** v0 לא נוגע ב-`useEffect`, `useState`, Supabase queries, או event handlers.

### ברנץ'ים
- שם: `[agent]/[תיאור]`
- merge רק דרך PR
- לא לדחוף ישירות ל-`main`

---

## 🔑 טיפוסים מרכזיים (מ-`lib/types.ts`)

```typescript
// סטטוס הקלטה
type RecStatus = "הוקלט" | "Optional" | "לא הוקלט"

// שורת סקריפט (מה-DB)
interface ScriptLine {
  id: string
  project_id: string
  script_id?: string
  line_number?: number
  timecode?: string
  role_name: string
  actor_id?: string
  source_text?: string
  translation?: string
  rec_status?: RecStatus | null
  notes?: string
  created_at?: string
}

// שורה לכתיבה ל-DB
type ScriptLineInput = Omit<ScriptLine, "id" | "created_at">

// סטטוסי מע"מ
type VatStatus = "ptor" | "murshe" | "artist_salary"
```

---

## 📚 מסמכי עזר

| קובץ | תוכן |
|------|------|
| `CLAUDE.md` | הקשר מלא לסוכני Claude — מפורט ביותר |
| `plan.md` | תוכנית מפורטת לשדרוג ה-parser (PDF/DOCX) |
| `WORKFLOW.md` | פרוטוקול עבודה Claude/v0 |
| `DEVELOPER_GUIDE.md` | מדריך מפתח מקיף |
| `docs/decisions/` | ADRs — החלטות ארכיטקטורה מתועדות |
| `docs/changes/` | לוג שינויים לפי תאריך |
| `SUPABASE_SETUP_GUIDE.md` | הגדרת DB (חד-פעמי) |
| `AUTH_SETUP_GUIDE.md` | הגדרת אוטנטיקציה |
| `SECURITY_AUDIT_REPORT.md` | דוח אבטחה |
