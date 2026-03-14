# Merge Preparation — Branch `claude/review-qa-findings-yXhjs`

**תאריך:** 2026-03-14
**מקור:** `claude/review-qa-findings-yXhjs` → `main`

---

## סיכום מה נעשה בברנץ' הזה

### קוד (34 קבצים שונו, ~3800 שורות)

| קטגוריה | מה נעשה |
|---|---|
| **Parser Stopwords (P0)** | רשימת ~40 מילות עצירה ב-tokenizer + structured-parser למניעת זיהוי כותרות כתפקידים |
| **Auth Guards** | `requireAuth()` נוסף לכל 14 ה-Server Actions + 5 API routes. מבוסס Supabase Auth בלבד |
| **i18n עברית** | הערות, ולידציית טפסים, toast messages — הכל בעברית |
| **Workspace שורות** | הוספת שורות ידנית, insert above/below, duplicate, עריכת source_text inline |
| **sort_index** | עמודה חדשה ב-script_lines לסדר מותאם אישית (בלי לשנות line_number) |
| **ספירת רפליקות** | תוקן לספור מה-DB ישירות (לא מוגבל ל-1000 שורות) |
| **פורמט תאריך** | utility חדש `formatDateHe()` — כל התאריכים ב-DD.MM.YYYY he-IL |
| **UX קטנים** | redirect אחרי draft, toast ייצוא, מונה שחקנים בסינון, סיבת דחייה (UI), תפריט פרויקט |

---

## מיגרציות DB שצריך להריץ לפני/אחרי המרג'

### חובה לפני מרג' — Migration 011

**קובץ:** `migrations/011_add_script_lines_sort_index.sql`

**מה עושה:**
1. מוסיף עמודה `sort_index INTEGER` לטבלת `script_lines`
2. מאתחל ערכים קיימים: `ROW_NUMBER() * 1024` (מחולק לפי project_id)
3. מגדיר `NOT NULL` אחרי האתחול
4. יוצר אינדקס `idx_script_lines_project_sort_index` על `(project_id, sort_index)`

**כיצד להריץ:**
```sql
-- ב-Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- העתק והדבק את כל התוכן של migrations/011_add_script_lines_sort_index.sql
-- לחץ Run

-- אימות:
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'script_lines' AND column_name = 'sort_index';
-- צריך להחזיר: sort_index | integer | NO

-- בדוק שהאינדקס נוצר:
SELECT indexname FROM pg_indexes
WHERE tablename = 'script_lines' AND indexname = 'idx_script_lines_project_sort_index';
```

**⚠️ שים לב:**
- המיגרציה בטוחה — משתמשת ב-`IF NOT EXISTS`
- אם יש שורות קיימות ב-script_lines, הן יקבלו sort_index אוטומטית
- אם אין שורות — זה פשוט יוסיף את העמודה

---

### לא חובה כרגע — `rejection_reason` (TASK-009)

ה-UI של סיבת דחייה **קיים** (textarea עם ולידציה של 10 תווים), אבל **העמודה בDB לא נוצרה**.
כרגע הערך לא נשמר לDB — רק מוצג ב-UI.

**כשתרצו להפעיל את זה:**
```sql
-- Migration 012 (עתידי)
ALTER TABLE actor_submissions
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- RLS (הכל פתוח כרגע):
-- כבר מכוסה בpolicies הקיימות
```

---

## Auth Guard — השפעה על הסביבה

`requireAuth()` קורא ל-`supabase.auth.getUser()`.

**מה זה אומר:**
- אם **אין** Supabase Auth מופעל (המצב הנוכחי — RLS פתוח, auth ברמת AuthContext) → **כל Server Action יזרוק שגיאה "Unauthorized"**
- צריך לוודא שאחד מהמצבים הבאים מתקיים:
  1. **Supabase Auth פעיל** — יש user מחובר עם session תקין, או
  2. **להוריד את ה-auth guards** אם עדיין לא מוכנים ל-Supabase Auth

**⚠️ זו נקודה קריטית:** כרגע ב-production האפליקציה משתמשת ב-AuthContext (client-side) בלבד, לא ב-Supabase Auth. אם תמזגו את הברנץ' הזה **בלי** להפעיל Supabase Auth, כל ה-Server Actions ייכשלו.

**אפשרויות:**
1. **מוכנים ל-Supabase Auth?** → מרג'ו כמו שזה. וודאו שהclient שולח session headers.
2. **לא מוכנים?** → לפני המרג', הסירו/בטלו את ה-`requireAuth()` קריאות (14 קבצים). ניתן לעשות find-and-replace:
   ```
   חפש:  await requireAuth()
   החלף: // await requireAuth() // TODO: enable when Supabase Auth is active
   ```

---

## מה עדיין פתוח (לא בברנץ' הזה)

### עדיפות גבוהה
| ID | תיאור | מה חסר |
|---|---|---|
| ADMIN-2 | מיזוג שחקן קיים בadmin | החלטת עיצוב — איך למזג כפילויות |
| Auth decision | החלטה על Supabase Auth | ראו סעיף למעלה |

### עדיפות בינונית (UX)
| ID | תיאור | הערה |
|---|---|---|
| ACTORS-3 | בחירה מרובה — הסר "הוסף לפרויקט" | שינוי UI קטן |
| ACTORS-4 | שדות עריכה תואמים לטופס | דורש סנכרון עם scprodub |
| ADMIN-3 | "נקה הכל" לבקשות דחויות | UI |
| PROJECTS-4 | calendar picker עם ניווט שנים | קומפוננטת date-input קיימת, חסר picker |
| PROJECTS-5 | סטטוסי פרויקט אחידים | enum/options |
| ROLES-1 | הסר אינדיקטור מקור תפקיד | שינוי UI קטן |
| ROLES-2 | "בחר הכל" בתפקידים | UI |

### Backlog (P3 מדוח QA)
| ID | תיאור |
|---|---|
| TASK-012 | Empty state illustrations |
| TASK-013 | Keyboard shortcuts (Ctrl+S לשמירה) |
| TASK-014 | Undo/Redo ב-workspace |
| TASK-015 | Audit log לשינויים |
| TASK-016 | Dark mode |
| TASK-017 | Bulk import שחקנים מ-CSV |
| TASK-018 | Dashboard עם סטטיסטיקות |

---

## בדיקות שהורצו

| בדיקה | תוצאה |
|---|---|
| `pnpm exec tsc --noEmit` | 0 errors |
| `pnpm vitest run` | 310 tests passed (10 files) |

---

## קבצים חדשים בברנץ'

| קובץ | תיאור |
|---|---|
| `lib/auth-guard.ts` | `requireAuth()` — auth check for Server Actions |
| `lib/format-date.ts` | `formatDateHe()`, `formatDateOnlyHe()` — פורמט תאריך ישראלי |
| `migrations/011_add_script_lines_sort_index.sql` | עמודת sort_index ל-script_lines |
| `PLAN.md` | תוכנית עבודה של ה-QA sprint |
| `QA-REVIEW-SUMMARY.md` | סיכום כל התיקונים לצוות QA |
| `QA-FIXES-DIFF.patch` | Patch מלא של כל השינויים |
