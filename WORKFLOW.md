# פרוטוקול עבודה - Casting Database Web App

## כלי פיתוח

| כלי | תפקיד |
| --- | --- |
| **Claude Code** | לוגיקה עסקית, TypeScript, server actions, DB, bug fixes |
| **v0.app** | UI prototyping, styling, עיצוב קומפוננטים |

---

## חלוקת אחריות

### Claude Code אחראי על:
- חיבורים ל-Supabase (queries, mutations)
- Server actions (`lib/actions/`)
- TypeScript types (`lib/types.ts`)
- Script parser (`lib/parser/`)
- תיקוני באגים בלוגיקה
- Schema migrations (`migrations/`)

### v0.app אחראי על:
- Tailwind classes ו-styling
- UI components (`components/ui/`)
- עיצוב, צבעים, responsive
- אנימציות ו-hover effects

**כלל:** v0 לא נוגע ב-`useEffect`, `useState`, Supabase queries, או event handlers.

---

## תהליך עבודה

```
main branch  ──►  feature branch  ──►  PR  ──►  merge to main
```

1. **תמיד** עבוד על feature branch, לא ישירות על main
2. שם branch: `feat/שם-הפיצ'ר` או `fix/שם-הבאג`
3. לפני PR - הרץ: `pnpm exec tsc --noEmit` + `pnpm test`
4. merge דרך PR בלבד

---

## Checklist לפני Push

- [ ] `pnpm exec tsc --noEmit` — 0 שגיאות TypeScript
- [ ] `pnpm test` — כל הטסטים עוברים
- [ ] בדקתי שהאפליקציה עולה ועובדת בדפדפן
- [ ] Commit message ברור (ראה DEVELOPER_GUIDE.md §12)

---

## אם יש קונפליקט בין v0 ל-Claude Code

Claude Code מנצח על כל מה שקשור ללוגיקה, v0 מנצח על styling בלבד.

```bash
git pull --rebase
# פתור קונפליקטים - שמור logic של Claude, styling של v0
git push
```

---

## ראה גם

- `DEVELOPER_GUIDE.md` — מדריך מלא לפיתוח
- `SUPABASE_SETUP_GUIDE.md` — הגדרת DB (חד-פעמי)
- `AUTH_SETUP_GUIDE.md` — הגדרת אוטנטיקציה (חד-פעמי)
- `migrations/` — SQL migrations שרצו על ה-DB
