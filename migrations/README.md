# Database Migrations

מדריך להרצת מיגרציות למסד הנתונים Supabase.

## סקירה כללית

תיקיית `migrations/` מכילה SQL scripts להתאמת schema של מסד הנתונים לקוד האפליקציה. כל migration מתועד ומסודר לפי תאריך.

---

## 📝 רשימת Migrations

### `001_align_schema.sql` (2026-02-16)

**מטרה:** התאמת schema למסד הנתונים אחרי מיזוג שני הריפואים והוספת פיצ'רים חדשים.

**שינויים עיקריים:**

1. **תיקון VAT Status**
   - ערכים תקינים: `'ptor'`, `'murshe'`, `'artist_salary'`
   - הוספת constraint לוולידציה
   - מיגרציית ערכים קיימים

2. **שדות שירה חדשים**
   - `singing_styles` (JSONB) - מערך של `{style, level}`
   - `singing_styles_other` (JSONB) - סגנונות מותאמים אישית
   - `singing_sample_url` - קישור לדוגמת שירה
   - `youtube_link` - קישור ליוטיוב
   - `singing_level` - רמת שירה (legacy)

3. **שדות ניסיון דיבוב**
   - `dubbing_experience_years` - ניסיון בדיבוב בשנים

4. **טבלאות חדשות**
   - `actor_submissions` - הגשות מטופס ציבורי
   - `project_scripts` - סקריפטים שהועלו לפרויקטים
   - `script_extracted_roles` - תפקידים שחולצו מסקריפטים
   - `script_casting_warnings` - אזהרות על קונפליקטים
   - `folders` - תיקיות לארגון שחקנים

5. **אינדקסים לביצועים**
   - אינדקסים על שדות מסוננים (gender, birth_year, vat_status)
   - אינדקסים על foreign keys
   - אינדקסים על created_at למיון

6. **RLS Policies**
   - הגנת נתונים ברמת שורה
   - גישת קריאה למשתמשים מאומתים
   - הרשאות מלאות למנהלים
   - הגשה חופשית לטופס הציבורי

---

## 🚀 הרצת Migration

### אופציה 1: דרך Supabase Dashboard (מומלץ)

1. היכנס ל-[Supabase Dashboard](https://app.supabase.com/)
2. בחר את הפרויקט שלך
3. לך ל-**SQL Editor** בתפריט הצד
4. העתק והדבק את תוכן `001_align_schema.sql`
5. לחץ **Run** (או Ctrl/Cmd + Enter)
6. ודא שאין שגיאות ב-console

### אופציה 2: דרך Supabase CLI

```bash
# התקנת Supabase CLI (פעם אחת)
npm install -g supabase

# התחברות לפרויקט
supabase login
supabase link --project-ref YOUR_PROJECT_REF

# הרצת migration
supabase db push --dry-run  # בדיקה בלבד
supabase db push             # הרצה אמיתית
```

### אופציה 3: דרך psql (למשתמשים מתקדמים)

```bash
# התחברות ישירה למסד הנתונים
psql "postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

# הרצת migration
\i migrations/001_align_schema.sql

# יציאה
\q
```

---

## ✅ אימות התקנה

אחרי הרצת ה-migration, וודא שהכל עבר בהצלחה:

### בדיקה 1: טבלאות קיימות

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
ORDER BY table_name;
```

צריכות להופיע:
- `actors`
- `actor_submissions`
- `actor_folders`
- `casting_projects`
- `project_roles`
- `role_castings`
- `role_conflicts`
- `project_scripts`
- `script_extracted_roles`
- `script_casting_warnings`
- `folders`

### בדיקה 2: עמודות חדשות ב-actors

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'actors'
  AND column_name IN (
    'singing_styles',
    'singing_styles_other',
    'dubbing_experience_years',
    'youtube_link',
    'singing_sample_url'
  );
```

כל העמודות צריכות להופיע.

### בדיקה 3: Constraints

```sql
SELECT constraint_name, constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'actors'
  AND constraint_name = 'actors_vat_status_check';
```

צריך להחזיר שורה אחת עם `CHECK` constraint.

### בדיקה 4: RLS Policies

```sql
SELECT schemaname, tablename, policyname, permissive, roles, cmd
FROM pg_policies
WHERE tablename IN ('actors', 'actor_submissions')
ORDER BY tablename, policyname;
```

צריכות להופיע policies לכל טבלה.

---

## 🔄 Rollback (ביטול)

אם יש בעיה ורוצה לבטל את ה-migration:

```sql
-- 1. מחק טבלאות חדשות
DROP TABLE IF EXISTS script_casting_warnings CASCADE;
DROP TABLE IF EXISTS script_extracted_roles CASCADE;
DROP TABLE IF EXISTS project_scripts CASCADE;
DROP TABLE IF EXISTS role_conflicts CASCADE;
DROP TABLE IF EXISTS role_castings CASCADE;
DROP TABLE IF EXISTS project_roles CASCADE;
DROP TABLE IF EXISTS casting_projects CASCADE;
DROP TABLE IF EXISTS actor_folders CASCADE;
DROP TABLE IF EXISTS actor_submissions CASCADE;
DROP TABLE IF EXISTS folders CASCADE;

-- 2. מחק עמודות חדשות מ-actors
ALTER TABLE actors DROP COLUMN IF EXISTS singing_styles;
ALTER TABLE actors DROP COLUMN IF EXISTS singing_styles_other;
ALTER TABLE actors DROP COLUMN IF EXISTS dubbing_experience_years;
ALTER TABLE actors DROP COLUMN IF EXISTS youtube_link;
ALTER TABLE actors DROP COLUMN IF EXISTS singing_sample_url;
ALTER TABLE actors DROP COLUMN IF EXISTS singing_level;
ALTER TABLE actors DROP COLUMN IF EXISTS other_lang_text;
ALTER TABLE actors DROP COLUMN IF EXISTS is_draft;
ALTER TABLE actors DROP COLUMN IF EXISTS updated_at;

-- 3. מחק constraints
ALTER TABLE actors DROP CONSTRAINT IF EXISTS actors_vat_status_check;

-- 4. מחק trigger
DROP TRIGGER IF EXISTS update_actors_updated_at ON actors;
DROP FUNCTION IF EXISTS update_updated_at_column();
```

⚠️ **אזהרה:** Rollback ימחק את כל הנתונים בטבלאות החדשות!

---

## 🐛 פתרון בעיות נפוצות

### שגיאה: "relation already exists"

**פתרון:** הטבלה כבר קיימת. אפשר להתעלם או למחוק קודם:

```sql
DROP TABLE IF EXISTS table_name CASCADE;
```

### שגיאה: "column already exists"

**פתרון:** העמודה כבר קיימת. ה-migration משתמש ב-`ADD COLUMN IF NOT EXISTS` אז זה לא צריך לקרות. אם קורה, זה בסדר להתעלם.

### שגיאה: "constraint already exists"

**פתרון:** ה-migration בודק אם ה-constraint קיים לפני יצירה. אם עדיין יש שגיאה:

```sql
-- מחק constraint קיים
ALTER TABLE actors DROP CONSTRAINT IF EXISTS actors_vat_status_check;
-- הרץ שוב את החלק הרלוונטי מה-migration
```

### שגיאה: RLS policy conflicts

**פתרון:** מחק policies קיימים:

```sql
DROP POLICY IF EXISTS "policy_name" ON table_name;
```

---

## 📊 סטטיסטיקות אחרי Migration

בדוק כמה רשומות יש בטבלאות החדשות:

```sql
SELECT
  'actors' AS table_name, COUNT(*) AS count FROM actors
UNION ALL
SELECT 'actor_submissions', COUNT(*) FROM actor_submissions
UNION ALL
SELECT 'casting_projects', COUNT(*) FROM casting_projects
UNION ALL
SELECT 'folders', COUNT(*) FROM folders;
```

---

## 📝 הערות חשובות

1. **גיבוי לפני הרצה:**
   - תמיד עשה backup של ה-DB לפני migration
   - ב-Supabase: Settings → Database → Backups

2. **סביבת Development:**
   - בדוק את ה-migration ב-dev לפני production
   - השתמש ב-`--dry-run` עם Supabase CLI

3. **ביצועים:**
   - יצירת אינדקסים יכולה לקחת זמן על DBs גדולים
   - הרץ ב-off-peak hours אם אפשר

4. **RLS:**
   - ודא שה-RLS policies מתאימות למדיניות האבטחה שלך
   - שנה את ה-admin email pattern בהתאם

---

## 🔗 קישורים נוספים

- [Supabase SQL Editor](https://app.supabase.com/project/_/sql)
- [Supabase CLI Docs](https://supabase.com/docs/guides/cli)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)

---

**צור קשר:** אם יש בעיות עם ה-migration, פנה לצוות הפיתוח.
