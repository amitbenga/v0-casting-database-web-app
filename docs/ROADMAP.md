# תוכנית המשך — Casting Database Web App

> **תאריך:** מרץ 2026
> **ברנץ' נוכחי:** `claude/improve-app-performance-y2wVC`
> **סטטוס:** מוכן למרג' — ביצועים + מערכת תסריטים הושלמו

---

## חלק א׳ — אופטימיזציית דאטהבייס

### 1. אינדקסים חסרים (עדיפות גבוהה)

הדאטהבייס חסר אינדקסים קריטיים לביצועים. ככל שהנתונים יגדלו (100+ שחקנים, 10+ פרויקטים, 1000+ שורות תסריט), השאילתות יאטו משמעותית.

```sql
-- חיפוש שחקנים לפי שם (autocomplete + search)
-- דורש הפעלת extension: CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE INDEX idx_actors_full_name_trgm
  ON actors USING gin (full_name gin_trgm_ops);

-- חיפוש castings לפי שחקן (דף שחקן, ספירת רפליקות)
CREATE INDEX idx_role_castings_actor_status
  ON role_castings (actor_id, status);

-- שאילתת folders עם ספירת שחקנים
CREATE INDEX idx_folder_actors_folder
  ON folder_actors (folder_id);

-- submissions לפי סטטוס (admin page)
CREATE INDEX idx_submissions_review_status
  ON actor_submissions (review_status)
  WHERE deleted_at IS NULL;

-- project_roles לפי פרויקט (casting workspace)
CREATE INDEX idx_project_roles_project
  ON project_roles (project_id);

-- script_lines — composite לסינון + pagination
CREATE INDEX idx_script_lines_project_line
  ON script_lines (project_id, line_number);
```

**איך לבצע:**
- צור `migrations/005_add_performance_indexes.sql`
- הרץ ב-Supabase SQL Editor
- אפשר pg_trgm רק אם נדרש fuzzy search בפרודקשן

### 2. צמצום Payload — `select("*")` (עדיפות בינונית)

נשארו ~14 מקומות עם `select("*")`. הקריטיים:

| קובץ | טבלה | מה לצמצם |
| --- | --- | --- |
| `submission-actions.ts:40` | actor_submissions | הסר `raw_payload` (JSON גדול) — צמצם ל-30 שדות ספציפיים |
| `submission-actions.ts:51` | actors | צמצם לשדות הנדרשים למיזוג |
| `admin/page.tsx:125` | actor_submissions | הסר `raw_payload` — לא מוצג ב-UI |
| `script-processing.ts:216` | project_scripts | צמצם ל-`id, project_id, file_name, file_url, file_type` |
| `casting-actions.ts:219,556` | role_conflicts | צמצם ל-`id, project_id, role_id_a, role_id_b, warning_type, scene_reference` |
| `script-actions.ts` (7 מקומות) | שונות | צמצם לפי הצורך |

**כלל אצבע:** כל `select("*")` שמחזיר JSON גדול (כמו `raw_payload`) או שרץ בעמוד ראשי — לתקן.

### 3. Database Views (עדיפות בינונית)

#### `project_summary` — View מרכזי לדף פרויקטים
במקום 3-4 שאילתות נפרדות לכל פרויקט, view אחד:

```sql
CREATE OR REPLACE VIEW project_summary AS
SELECT
  cp.id,
  cp.name,
  cp.status,
  cp.director,
  cp.casting_director,
  cp.project_date,
  cp.notes,
  cp.created_at,
  COUNT(DISTINCT pr.id) AS roles_count,
  COUNT(DISTINCT rc.actor_id) FILTER (WHERE rc.status = 'מלוהק') AS actors_cast,
  COUNT(DISTINCT ps.id) AS scripts_count,
  COUNT(sl.id) AS total_lines,
  COUNT(sl.id) FILTER (WHERE sl.rec_status = 'הוקלט') AS recorded_lines
FROM casting_projects cp
LEFT JOIN project_roles pr ON pr.project_id = cp.id
LEFT JOIN role_castings rc ON rc.role_id = pr.id
LEFT JOIN project_scripts ps ON ps.project_id::text = cp.id
LEFT JOIN script_lines sl ON sl.project_id = cp.id
GROUP BY cp.id;
```

#### `actor_summary` — View לרשימת שחקנים
```sql
CREATE OR REPLACE VIEW actor_summary AS
SELECT
  a.id,
  a.full_name,
  a.gender,
  a.birth_year,
  a.phone,
  a.email,
  a.image_url,
  a.voice_sample_url,
  a.city,
  a.is_singer,
  a.is_course_grad,
  a.vat_status,
  a.dubbing_experience_years,
  a.skills,
  a.languages,
  a.created_at,
  COUNT(DISTINCT rc.role_id) FILTER (WHERE rc.status = 'מלוהק') AS active_roles,
  COUNT(DISTINCT rc.role_id) AS total_castings
FROM actors a
LEFT JOIN role_castings rc ON rc.actor_id = a.id
GROUP BY a.id;
```

### 4. סכמה סופית — תיקוני עקביות (עדיפות בינונית)

#### בעיה: ID types מעורבים
- `actors.id` = TEXT
- `casting_projects.id` = TEXT
- `project_roles.id` = UUID
- `role_castings.id` = UUID
- `script_lines.id` = TEXT

**המלצה:** לא לשנות כרגע. השינוי ידרוש מיגרציה מורכבת עם downtime. הטיפוסים עובדים עם casting אוטומטי. תעדף יציבות על עקביות בשלב הזה.

#### CHECK constraints חסרים
```sql
-- project status
ALTER TABLE casting_projects
  ADD CONSTRAINT chk_project_status
  CHECK (status IN ('not_started', 'casting', 'voice_testing', 'casted', 'recording', 'completed'));

-- rec_status
ALTER TABLE script_lines
  ADD CONSTRAINT chk_rec_status
  CHECK (rec_status IS NULL OR rec_status IN ('הוקלט', 'Optional', 'לא הוקלט'));

-- vat_status
ALTER TABLE actors
  ADD CONSTRAINT chk_vat_status
  CHECK (vat_status IS NULL OR vat_status IN ('ptor', 'murshe', 'artist_salary'));
```

### 5. RLS — תוכנית אבטחה (לפני פרודקשן)

**מצב נוכחי:** כל הטבלאות פתוחות (`USING (true)`). זה מספיק לפיתוח אבל **לא מתאים לפרודקשן**.

**תוכנית מינימלית (שלב 1):**

```sql
-- שלב 1: הגבל מחיקות לadmin בלבד
-- (כל הread/insert/update נשארים פתוחים)

-- actors
DROP POLICY IF EXISTS "actors_delete" ON actors;
CREATE POLICY "actors_delete" ON actors
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()::text AND role = 'admin'
    )
  );

-- דומה לכל הטבלאות...
```

**תוכנית מלאה (שלב 2 — עתידי):**
- viewer = read only
- admin = full CRUD
- דורש מעבר ל-Supabase Auth אמיתי (לא רק email/password fallback)

### 6. Supabase Edge Functions (אופציונלי — עתידי)

למשימות כבדות שלא צריכות לחסום את ה-UI:

| פונקציה | מה עושה | למה Edge Function |
| --- | --- | --- |
| `translate-batch` | תרגום AI ב-background | מנע timeout ב-Next.js (30s limit on Vercel) |
| `export-project` | ייצוא Excel מלא של פרויקט | חישוב כבד + יצירת קובץ |
| `cleanup-drafts` | מחיקת drafts ישנים | scheduled job (cron) |

---

## חלק ב׳ — תוכנית המשך לאפליקציה

### שלב 1: יציבות ופרודקשן (שבוע 1-2)

**מטרה:** להעביר את האפליקציה לפרודקשן כך שמשתמשים אמיתיים יוכלו להשתמש בה.

#### 1.1 תיקוני באגים פתוחים (חובה)

| ID | עדיפות | תיאור | הערכת מורכבות |
| --- | --- | --- | --- |
| ADMIN-2 | גבוה | מיזוג שחקן קיים — דורש עיצוב UI | בינוני |
| ACTORS-3 | בינוני | הסר "הוסף לפרויקט" בבחירה מרובה | קל |
| ADMIN-3 | בינוני | נקה הכל + בחירה סלקטיבית | קל |
| PROJECTS-5 | בינוני | סטטוסי פרויקט לא אחידים | קל |
| ROLES-1 | בינוני | הסר אינדיקטור מקור תפקיד | קל |
| ROLES-2 | בינוני | הוסף "בחר הכל" לבחירה מרובה | קל |

#### 1.2 הגדרת סביבת פרודקשן

- [ ] **Vercel deployment** — הגדר project ב-Vercel
- [ ] **Environment variables** — `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, (ואם יש תרגום: `ANTHROPIC_API_KEY`)
- [ ] **Domain** — הגדר domain מותאם (casting.scprodub.co.il או דומה)
- [ ] **Supabase project** — ודא שה-project ב-production tier (לא free tier)
- [ ] **next.config.mjs** — הסר `ignoreBuildErrors: true` ותקן כל build error
- [ ] **next.config.mjs** — הסר `unoptimized: true` או שמור אם תמונות מגיעות מ-URL חיצוני

#### 1.3 אבטחה מינימלית

- [ ] הפעל RLS שלב 1 (הגבל DELETE ל-admin)
- [ ] ודא ש-Supabase anon key לא חושף פעולות מסוכנות
- [ ] הוסף rate limiting ב-Vercel (או middleware)
- [ ] בדוק שאין secrets ב-client bundle

#### 1.4 ניטור

- [ ] **Vercel Analytics** — כבר מותקן, רק צריך `<Analytics />` ב-layout
- [ ] **Error tracking** — הוסף Sentry (חינמי ל-5K events/חודש) או לפחות error boundary
- [ ] **Uptime monitor** — BetterUptime / UptimeRobot (חינמי)

### שלב 2: חוויית משתמש (שבוע 2-3)

**מטרה:** שיפורים שמשתמשים יבקשו מיד.

#### 2.1 Calendar Picker לתאריכים
- הקומפוננטה `date-input.tsx` קיימת אבל בלי calendar popup
- להוסיף calendar picker עם ניווט שנים (shadcn date picker)
- להחליף בכל מקום שיש תאריך: פרויקטים, שחקנים

#### 2.2 שיפור Admin Workflow
- **ADMIN-2 (מיזוג שחקן):** UI שמציג diff בין submission לשחקן קיים, side-by-side, עם בחירת שדות למיזוג
- **הודעות toast** — ודא שכל פעולה מצליחה/נכשלת מציגה הודעה ברורה

#### 2.3 שיפורי UI קטנים
- Responsive: ודא שהאפליקציה עובדת על טאבלט (לא חובה מובייל)
- Loading states: ודא שכל כפתור מציג spinner בזמן פעולה
- Empty states: הודעות ברורות כשאין נתונים ("אין שחקנים", "אין פרויקטים")
- Breadcrumbs: ניווט ברור בדפי פנים

### שלב 3: תכונות נדרשות (שבוע 3-5)

**מטרה:** תכונות שמשתמשים צריכים כדי להחליף את ה-Excel לחלוטין.

#### 3.1 ייצוא פרויקט מלא
- ייצוא Excel עם כל הנתונים: תפקידים, שיבוצים, שורות תסריט, תרגומים
- פורמט RTL עם עיצוב מקצועי (כמו script-workspace-tab כבר עושה)
- **זה הפיצ'ר שיחליף את ה-Excel כ-output**

#### 3.2 עריכת Timecode
- עריכה inline בטבלת script workspace
- פורמט HH:MM:SS:FF עם validation
- sorting לפי timecode

#### 3.3 סטטוסי פרויקט
- הגדר flow ברור: `not_started` → `casting` → `voice_testing` → `casted` → `recording` → `completed`
- מעבר סטטוס אוטומטי (כל התפקידים שובצו → "casted", וכו')
- Dashboard עם סטטוס כל הפרויקטים

#### 3.4 דוחות
- **דוח ליהוק** — PDF מסודר עם כל התפקידים + שחקנים מלוהקים
- **דוח הקלטה** — התקדמות הקלטה לפי שחקן, תפקיד, סטטוס
- **דוח שחקן** — כל הפרויקטים שהשחקן משתתף בהם + רפליקות

### שלב 4: פיצ'רים מתקדמים (שבוע 5+)

**מטרה:** תכונות שמייחדות את האפליקציה מ-Excel.

#### 4.1 Notifications
- הודעה כשמשתמש אחר שינה casting
- הודעה כשתרגום AI הושלם
- (אופציונלי) email notification

#### 4.2 Activity Log
- מי שינה מה ומתי
- היסטוריית שינויים לכל פרויקט
- rollback לגרסה קודמת (אופציונלי)

#### 4.3 Multi-User Collaboration
- Role-based access: admin, casting_director, viewer
- הקצאת פרויקטים למשתמשים ספציפיים
- real-time indicators ("X עורך כרגע")

#### 4.4 שיפורי Parser
- תמיכה ב-screenplay format מתקדם (dual dialogue, parentheticals)
- שיפור זיהוי שפה אוטומטי
- תמיכה בפורמטים נוספים (SRT, Final Draft FDX)

---

## חלק ג׳ — סדר עדיפויות למרג' הנוכחי ולאחריו

### מה מוכן עכשיו (בראנץ' נוכחי)
```
✅ SWR caching + key factory
✅ Skeleton loading (8 דפים)
✅ Navigation prefetching (<Link>)
✅ Auth optimization (singleton + cache)
✅ Dynamic imports (4 טאבים)
✅ Payload optimization (narrowed selects)
✅ Universal file import (PDF/DOCX/TXT)
✅ Auto-sync actors from casting
✅ Auto-translate EN→HE
```

### סדר עדיפויות אחרי מרג'

```
🔴 קריטי (שבוע 1)
├── תיקוני באגים פתוחים (ACTORS-3, ADMIN-3, PROJECTS-5, ROLES-1, ROLES-2)
├── DB indexes (migration 005)
├── הסרת ignoreBuildErrors מ-next.config
└── Vercel deployment + env vars

🟠 גבוה (שבוע 2)
├── RLS שלב 1 (הגבל DELETE)
├── Sentry error tracking
├── צמצום select("*") (14 מקומות)
└── Calendar picker

🟡 בינוני (שבוע 3-4)
├── ADMIN-2 — מיזוג שחקנים (UI design)
├── ייצוא פרויקט מלא
├── עריכת timecode
├── project_summary view
└── סטטוס פרויקט אוטומטי

🟢 נמוך (שבוע 5+)
├── Activity log
├── Notifications
├── Multi-user
├── RLS שלב 2 (role-based)
└── Edge Functions
```

---

## חלק ד׳ — מיגרציות מתוכננות

### Migration 005 — Performance Indexes
```sql
-- File: migrations/005_add_performance_indexes.sql
-- Status: מתוכנן

CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_actors_full_name_trgm
  ON actors USING gin (full_name gin_trgm_ops);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_castings_actor_status
  ON role_castings (actor_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_submissions_review_status
  ON actor_submissions (review_status) WHERE deleted_at IS NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_project_roles_project
  ON project_roles (project_id);
```

### Migration 006 — CHECK Constraints
```sql
-- File: migrations/006_add_check_constraints.sql
-- Status: מתוכנן

ALTER TABLE casting_projects
  ADD CONSTRAINT IF NOT EXISTS chk_project_status
  CHECK (status IN ('not_started', 'casting', 'voice_testing', 'casted', 'recording', 'completed'));

ALTER TABLE script_lines
  ADD CONSTRAINT IF NOT EXISTS chk_rec_status
  CHECK (rec_status IS NULL OR rec_status IN ('הוקלט', 'Optional', 'לא הוקלט'));

ALTER TABLE actors
  ADD CONSTRAINT IF NOT EXISTS chk_vat_status
  CHECK (vat_status IS NULL OR vat_status IN ('ptor', 'murshe', 'artist_salary'));
```

### Migration 007 — Views
```sql
-- File: migrations/007_create_views.sql
-- Status: מתוכנן

CREATE OR REPLACE VIEW project_summary AS
SELECT ... (ראה חלק א׳ סעיף 3);

CREATE OR REPLACE VIEW actor_summary AS
SELECT ... (ראה חלק א׳ סעיף 3);
```

### Migration 008 — RLS Phase 1
```sql
-- File: migrations/008_rls_phase1.sql
-- Status: מתוכנן — דורש Supabase Auth פעיל

-- הגבל DELETE לadmin בלבד
-- ... (ראה חלק א׳ סעיף 5)
```

---

## חלק ה׳ — Deployment Checklist

### לפני Go-Live

```
Pre-deployment:
□ pnpm exec tsc --noEmit → 0 errors
□ pnpm test → all passing
□ pnpm build → succeeds without ignoreBuildErrors
□ Remove ignoreBuildErrors: true from next.config
□ Review all select("*") for unnecessary data
□ Run migration 005 (indexes)
□ Verify RLS policies (at minimum: DELETE restricted)
□ Set up Supabase production project (not free tier)

Environment:
□ NEXT_PUBLIC_SUPABASE_URL — production URL
□ NEXT_PUBLIC_SUPABASE_ANON_KEY — production key
□ ANTHROPIC_API_KEY — for AI translation (server-only)

Vercel:
□ Connect GitHub repo
□ Set build command: pnpm build
□ Set environment variables
□ Configure custom domain
□ Enable Analytics
□ Set up preview deployments for PRs

Monitoring:
□ Sentry DSN configured
□ Error boundary in layout.tsx
□ Vercel Analytics <Analytics /> in layout
□ Uptime monitoring set up

Post-deployment:
□ Smoke test: create actor, create project, assign role
□ Test file upload (Excel, PDF)
□ Test translation feature
□ Verify admin login works
□ Check response times < 2s for main pages
```

---

## חלק ו׳ — ארכיטקטורה — מבט על

```
┌─────────────────────────────────────────────────┐
│                    Users                         │
│         (Admin / Casting Director / Viewer)       │
└──────────────────────┬──────────────────────────┘
                       │
                       ▼
┌─────────────────────────────────────────────────┐
│              Vercel (Next.js 16)                 │
│  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │  Pages    │  │  Server  │  │  API Routes   │  │
│  │  (SSR)   │  │  Actions │  │  (progress)   │  │
│  └────┬─────┘  └────┬─────┘  └──────┬────────┘  │
│       │              │               │            │
│       ▼              ▼               ▼            │
│  ┌─────────────────────────────────────────┐     │
│  │        Supabase Client (anon key)       │     │
│  └────────────────────┬────────────────────┘     │
└───────────────────────┼─────────────────────────┘
                        │
                        ▼
┌─────────────────────────────────────────────────┐
│              Supabase (PostgreSQL)                │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐   │
│  │  Tables   │  │  Auth    │  │  Storage     │   │
│  │  (12+)   │  │  (users) │  │  (files)     │   │
│  └──────────┘  └──────────┘  └──────────────┘   │
│  ┌──────────────────────────────────────────┐    │
│  │  RLS Policies (currently: public)        │    │
│  └──────────────────────────────────────────┘    │
└─────────────────────────────────────────────────┘

External:
┌──────────────────┐     ┌─────────────────────┐
│  scprodub form   │────▶│  actor_submissions   │
│  (public intake) │     │  (same Supabase DB)  │
└──────────────────┘     └─────────────────────┘

┌──────────────────┐
│  Anthropic API   │◀──── translateScriptLines()
│  (Claude Sonnet) │      (batches of 40 lines)
└──────────────────┘
```

---

## סיכום

האפליקציה **מוכנה תפקודית** — כל הפיצ'רים העיקריים עובדים:
- מאגר שחקנים מלא (CRUD, חיפוש, סינון, תיקיות)
- ניהול פרויקטים + ליהוק + conflicts
- סביבת עבודה לתסריט (ייבוא, עריכה, תרגום, ייצוא)
- Parser חכם ל-4 פורמטי קבצים

**מה נדרש לפרודקשן:**
1. תיקוני באגים פתוחים (5-6 באגים קלים)
2. DB indexes + CHECK constraints
3. RLS מינימלי
4. Deployment ל-Vercel + monitoring

**הזמן הצפוי:** שבוע-שבועיים לגרסה ראשונה בפרודקשן, עם שיפורים מתמשכים לאחר מכן.
