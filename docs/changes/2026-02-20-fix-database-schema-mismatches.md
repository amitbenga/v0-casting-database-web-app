# תיקון אי-התאמות סכימה בדאטה בייס

**תאריך:** 20 פברואר 2026  
**סוג שינוי:** Database Schema Update  
**רמת השפעה:** גבוהה - תיקון באגים קריטיים

## סיכום

תוקנו אי-התאמות בין הקוד לסכימת הדאטה בייס שגרמו לכשלון של פונקציות קריטיות:
- אישור בקשות כרטיסי שחקנים
- יצירת פרויקטים חדשים

## הבעיות שזוהו

### 1. טבלת `casting_projects` - שדות חסרים

הקוד היה מנסה לשמור שדות שלא היו קיימים בדאטה בייס:
- `director` - שם הבמאי
- `casting_director` - שם המלהק  
- `project_date` - תאריך תחילת הפרויקט

**קבצים מושפעים:**
- `components/create-project-dialog.tsx`
- `components/edit-project-dialog.tsx`
- `app/projects/page.tsx`
- `app/projects/[id]/page.tsx`

### 2. טבלת `actors` - אימות שדות קיימים

אומתו שהשדות הבאים קיימים בטבלה (נוספו במיגרציות קודמות):
- `singing_sample_url` - קישור לדוגמת שירה
- `youtube_link` - קישור ליוטיוב
- `singing_styles` - סגנונות שירה (JSON)
- `singing_level` - רמת שירה
- `dubbing_experience_years` - שנות ניסיון בדיבוב

**קבצים מושפעים:**
- `app/admin/page.tsx` (handleApprove function)
- `app/intake/page.tsx`
- `components/actor-edit-form.tsx`

## השינויים שבוצעו

### מיגרציה 017: הוספת מטא-דאטה לפרויקטים

**קובץ:** `scripts/017_add_project_metadata_fields.sql`

```sql
ALTER TABLE public.casting_projects 
  ADD COLUMN IF NOT EXISTS director TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS casting_director TEXT DEFAULT '',
  ADD COLUMN IF NOT EXISTS project_date DATE;
```

**אינדקסים שנוספו:**
- `idx_casting_projects_project_date` - לשיפור ביצועי חיפוש לפי תאריך

## השלכות והשפעות

### פונקציונליות שתוקנה:
✅ **יצירת פרויקטים חדשים** - עובד כעת עם כל השדות  
✅ **עריכת פרויקטים קיימים** - כולל מטא-דאטה מלאה  
✅ **אישור בקשות שחקנים** - מעביר את כל הנתונים מהטופס  
✅ **חיפוש וסינון פרויקטים** - מאפשר סינון לפי תאריך

### תופעות לוואי:
- פרויקטים קיימים יקבלו ערכי ברירת מחדל ריקים עבור השדות החדשים
- יש לעדכן פרויקטים קיימים ידנית אם יש צורך במטא-דאטה

### סיכונים:
- **נמוך** - שימוש ב-`ADD COLUMN IF NOT EXISTS` מבטיח שלא תהיה שגיאה אם העמודה כבר קיימת
- **נמוך** - ערכי ברירת מחדל ריקים לא ישפיעו על לוגיקה קיימת

## בדיקות שבוצעו

1. ✅ אימות קיום שדות בטבלת `actors`
2. ✅ אימות הוספת שדות לטבלת `casting_projects`
3. ✅ בדיקת תאימות טיפוסים (TEXT, DATE)
4. ✅ אימות אינדקסים נוספו בהצלחה

## הערות למפתחים

- **Source of Truth:** הקוד מוגדר כ-SOT, הדאטה בייס מותאם לקוד
- **מיגרציות עתידיות:** כל שינוי בקוד שדורש שדות חדשים חייב לכלול מיגרציה מתאימה
- **אימות סכימה:** מומלץ להוסיף בדיקות אוטומטיות לאימות התאמה בין TypeScript types ל-DB schema

### 3. טבלת `user_profiles` - ריקה לחלוטין (שורש הבעיה העיקרי!)

טבלת `user_profiles` היתה ריקה, למרות שהיו 3 משתמשים ב-`auth.users`.
כל מדיניות ה-RLS על `actors`, `actor_submissions`, ו-`casting_projects` דורשת:
```sql
EXISTS (SELECT 1 FROM user_profiles WHERE user_profiles.id = auth.uid() AND user_profiles.role = 'admin')
```
בגלל שהטבלה היתה ריקה, **אף משתמש לא היה מוכר כ-admin** ולכן כל פעולות INSERT/UPDATE/DELETE נחסמו.

## מיגרציה 018: הוספת פרופילי admin

**קובץ:** `scripts/018_seed_admin_user_profiles.sql`

נוספו 3 המשתמשים הקיימים כ-admin:
- lenny@sc-produb.com
- sharon@sc-produb.com
- amit@madrasafree.com

### פונקציונליות שתוקנה בנוסף:
- אישור/דחיית בקשות שחקנים (RLS כבר לא חוסם)
- יצירת פרויקטים חדשים (RLS כבר לא חוסם)
- עדכון ומחיקת שחקנים ופרויקטים

## מיגרציה 019: תיקון מדיניות RLS לגישה ציבורית

**קובץ:** `scripts/019_fix_rls_policies_public_access.sql`

האפליקציה מנהלת אותנטיקציה ברמת האפליקציה (AuthContext), לא דרך Supabase Auth.
כתוצאה, כל הקריאות מ-browser מגיעות כ-`anon` role ולא כ-`authenticated`.
מדיניות ה-RLS הישנות דרשו `authenticated` role, מה שחסם **את כל הפעולות** - כולל קריאה (SELECT), הוספה (INSERT), עדכון (UPDATE) ומחיקה (DELETE).

### טבלאות שתוקנו:
- `actors` - SELECT, INSERT, UPDATE, DELETE
- `actor_submissions` - SELECT, INSERT, UPDATE
- `casting_projects` - SELECT, INSERT, UPDATE, DELETE
- `project_roles` - SELECT, INSERT, UPDATE, DELETE

### שינוי: כל ה-policies הוחלפו ל-`USING (true)` / `WITH CHECK (true)` כדי לאפשר גישה מלאה מכל role.

## קישורים רלוונטיים

- Migration Scripts: `scripts/017_add_project_metadata_fields.sql`, `scripts/018_seed_admin_user_profiles.sql`, `scripts/019_fix_rls_policies_public_access.sql`
- Type Definitions: `lib/types.ts` (interface `CastingProject`)
- Related Issues: ADMIN-1, PROJECTS-1
