# תוכנית עבודה — QA Findings Fix

## סיכום שינויים מדוח QA המקורי
- **TASK-002 (פרסור עברי) — נמחק**: תסריטים תמיד באנגלית. עברית = שפת ממשק בלבד.
- **TASK-005 — מעודכן**: `/projects` הוא דף הבית. הבאג הוא שאחרי שמירת טיוטה צריך לנווט ל-`/actors`.
- **TASK-008 — לוודא**: ייתכן שכבר עובד דרך SWR mutate.
- **P3 (TASK-012-018) — backlog**: לא בסבב הזה.

---

## Sprint 1 — P0 + P1

### TASK-001 · Stopwords לפרסר (P0)
**קובץ:** `lib/parser/tokenizer.ts`
**מה לעשות:**
1. הוסף מערך STOPWORDS בראש הקובץ:
   ```
   SCENE, INT, EXT, CUT TO, FADE IN, FADE OUT, END OF,
   CHARACTER LIST, CAST, ACT, EPISODE, PAGE, CHAPTER,
   SCRIPT TITLE, CONTINUED, MORE, THE END
   ```
2. בפונקציית זיהוי bare character (שורות 169-201), הוסף בדיקה:
   - אם השם נמצא ב-STOPWORDS → דלג
   - אם השם מסתיים ב-`:` → דלג (זו כותרת)
   - אם השם מתחיל במספר → דלג
3. הוסף את אותם פילטרים גם ב-`extractDialogueLines()` ב-`structured-parser.ts`
4. כתוב טסטים: קובץ עם 5 תפקידים + 5 כותרות → מזהה בדיוק 5

### TASK-003 · תרגום Comments לעברית (P1)
**קובץ:** `components/actor-comments.tsx`
**מה לעשות:**
1. החלף טקסטים קשוחים:
   - "Comments" → "הערות"
   - "Add a comment..." → "הוסף הערה..."
   - "Add Comment" → "הוסף הערה"
2. שנה פורמט תאריך מ-`en-US` ל-`he-IL`:
   ```js
   toLocaleString("he-IL", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })
   ```
   תוצאה: "23.06.2025, 16:39"
3. לא לגעת ב-persistence (mock נשאר) — זה עתידי

### TASK-004 · ולידציה בעברית בטפסים (P1)
**קבצים:** `app/intake/page.tsx`, טפסי יצירת פרויקט
**מה לעשות:**
1. ב-intake form: החלף `required` attribute בולידציה custom עם הודעות עבריות
2. בטופס יצירת פרויקט: אותו דבר — הסר `required` נייטיבי, הוסף custom validation
3. הודעות לדוגמה: "שם הפרויקט הוא שדה חובה", "נא למלא שם מלא"

### TASK-005 · Redirect אחרי שמירת טיוטה (P1)
**קובץ:** `app/intake/page.tsx` שורה 236
**מה לעשות:**
1. שנה `router.push("/")` ל-`router.push("/actors")`
2. תיקון פשוט של שורה אחת

### TASK-006 · Toast feedback לייצוא ושיתוף (P1)
**קבצים:** `app/actors/page.tsx` (handleBulkExport), דף פרויקט (export)
**מה לעשות:**
1. הוסף toast הצלחה אחרי ייצוא מוצלח: "הקובץ הורד בהצלחה"
2. אם יש כפתור share — הוסף toast "הקישור הועתק ללוח"
3. הוסף loading state בזמן ייצוא (disable כפתור + spinner)

### TASK-007 · מונה שחקנים מתעדכן בסינון (P1)
**קובץ:** `app/actors/page.tsx` שורות 646-650
**מה לעשות:**
1. שנה את הטאב label:
   ```jsx
   {hasActiveFilters
     ? `תוצאות (${filteredActors.length})`
     : `כל השחקנים (${nonDraftActors.length})`}
   ```
2. הגדר `hasActiveFilters` — true אם יש search text או פילטר פעיל

### TASK-008 · מונה תסריטים — לוודא ולתקן (P1)
**קבצים:** `components/projects/scripts-tab.tsx`, `app/projects/[id]/page.tsx`
**מה לעשות:**
1. בדוק אם `onScriptApplied` נקרא בכל מקרה אחרי עיבוד מוצלח
2. אם לא — הוסף קריאה ל-callback אחרי העלאה/עיבוד מוצלח
3. וודא שה-tab count מתעדכן דרך SWR mutate

---

## Sprint 2 — P2

### TASK-009 · ולידציה לסיבת דחייה (P2)
**קבצים:** `app/admin/page.tsx`, אולי migration חדשה
**מה לעשות:**
1. הוסף textarea לסיבת דחייה בדיאלוג (כרגע אין שדה כלל)
2. ולידציה: מינימום 10 תווים
3. placeholder: "לדוגמה: הקול לא מתאים לדמות..."
4. שמור ב-DB — בדוק אם צריך migration (הוספת עמודה rejection_reason ל-actor_submissions)

### TASK-010 · פורמט תאריך אחיד (P2)
**קבצים:** `components/actor-comments.tsx`, כל מקום עם toLocaleString
**מה לעשות:**
1. צור utility function `formatDate(date: string | Date): string` ב-`lib/utils.ts`
2. פורמט: `he-IL`, timezone `Asia/Jerusalem`
3. החלף כל שימוש inline ב-utility

### TASK-011 · סנכרון תפריט 3 נקודות (P2)
**קבצים:** `app/projects/[id]/page.tsx` (header menu)
**מה לעשות:**
1. הוסף "ייצוא" לתפריט בדף פרויקט
2. וודא שכל האפשרויות מסונכרנות עם כרטיס הפרויקט

---

## לא בסבב הזה (Backlog)
- TASK-002: נמחק (תסריטים באנגלית בלבד)
- TASK-012-018: P3, בדיקות QA עתידיות

---

## בדיקות לפני push
```bash
pnpm exec tsc --noEmit   # 0 errors
pnpm test                # all tests pass
```
