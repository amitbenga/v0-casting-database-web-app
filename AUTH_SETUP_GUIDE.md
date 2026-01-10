# 🔐 מדריך הקמת מערכת אימות

## שלבים להפעלת המערכת

### 1. הרצת סקריפט ה-SQL ב-Supabase

1. היכנס ל-**Supabase Dashboard**
2. לחץ על **SQL Editor** בתפריט הצד
3. פתח את הקובץ `scripts/006_setup_auth_and_rls.sql`
4. העתק את כל התוכן והדבק ב-SQL Editor
5. לחץ על **Run** (או Ctrl+Enter)

הסקריפט יבצע:
- ✅ הפעלת Row Level Security על כל הטבלאות
- ✅ יצירת טבלת `user_profiles`
- ✅ הגדרת מדיניות RLS לכל טבלה
- ✅ יצירת Trigger ליצירת פרופיל אוטומטי

---

### 2. יצירת משתמשים ב-Supabase

1. היכנס ל-**Supabase Dashboard**
2. לחץ על **Authentication** → **Users**
3. לחץ על **Add User** (או **Invite User**)

#### משתמש 1: Leni (Admin)
```
Email: leni@madrasafree.org
Password: [בחר סיסמה חזקה - לפחות 8 תווים]
User Metadata (JSON):
{
  "full_name": "Leni",
  "role": "admin"
}
```

#### משתמש 2: Sharon (Admin)
```
Email: sharon@madrasafree.org
Password: [בחר סיסמה חזקה - לפחות 8 תווים]
User Metadata (JSON):
{
  "full_name": "Sharon",
  "role": "admin"
}
```

**חשוב:** שמור את הסיסמאות במקום מאובטח!

---

### 3. בדיקת המערכת

1. **Deploy את הקוד החדש ל-Vercel**
   ```bash
   git add .
   git commit -m "feat: add authentication system"
   git push origin main
   ```

2. **המתן לסיום ה-Deployment** (כ-2-3 דקות)

3. **נסה להיכנס לאתר**
   - אתר יפנה אוטומטית ל-`/login`
   - הזן אחד מהמשתמשים שיצרת
   - אם הכל עובד - תועבר לדף הבית!

---

## מבנה המערכת

### דפים מוגנים

| דף | הגנה | הרשאה נדרשת |
| :--- | :---: | :--- |
| `/` (דף הבית) | ✅ | משתמש מחובר |
| `/actors/[id]` | ✅ | משתמש מחובר |
| `/folders` | ✅ | משתמש מחובר |
| `/folders/[id]` | ✅ | משתמש מחובר |
| `/projects` | ✅ | משתמש מחובר |
| `/projects/[id]` | ✅ | משתמש מחובר |
| `/admin` | ✅ | **Admin בלבד** |
| `/intake` | ❌ | ציבורי (טופס הגשה) |
| `/login` | ❌ | ציבורי |

### תפקידים (Roles)

- **admin** - גישה מלאה לכל הדפים כולל Admin
- **viewer** - גישה לצפייה בלבד (אין הרשאות עריכה)

---

## פתרון בעיות

### בעיה: "אין הרשאה" למשתמש Admin
**פתרון:** בדוק ב-Supabase שה-`user_metadata` כולל `"role": "admin"`

### בעיה: לא מצליח להתחבר
**פתרון:** 
1. בדוק שהמשתמש נוצר ב-Supabase
2. בדוק שהסיסמה נכונה
3. בדוק את ה-Console בדפדפן לשגיאות

### בעיה: RLS חוסם פעולות
**פתרון:** ודא שהסקריפט SQL רץ בהצלחה. בדוק:
```sql
SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';
```
כל הטבלאות צריכות להיות עם `rowsecurity = true`

---

## הוספת משתמש חדש (בעתיד)

1. Supabase Dashboard → Authentication → Users → Add User
2. הזן Email, Password
3. הוסף User Metadata:
   ```json
   {
     "full_name": "שם המשתמש",
     "role": "admin"  // או "viewer"
   }
   ```
4. הפרופיל ייווצר אוטומטית!

---

## אבטחה

✅ **מה מוגן:**
- כל הדפים דורשים התחברות (מלבד `/intake` ו-`/login`)
- דף Admin דורש הרשאת admin
- RLS מונע גישה ישירה לנתונים ללא הרשאה
- Supabase Auth מנהל את ה-Sessions בצורה מאובטחת

✅ **מה עדיין צריך:**
- הוספת "שכחתי סיסמה"
- הוספת "שינוי סיסמה"
- Audit log למעקב אחר פעולות

---

**הערה:** אם יש בעיות, בדוק את ה-Console בדפדפן ואת הלוגים ב-Supabase.
