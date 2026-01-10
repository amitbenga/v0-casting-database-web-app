# פרוטוקול חלוקת משימות: Manus vs v0

## תאריך: 10 בינואר 2026

---

## 🎯 מטרה

למנוע קונפליקטים ב-Git כאשר גם Manus וגם v0 עובדים על אותו פרויקט (`v0-casting-database-web-app`).

---

## 📋 חלוקת תחומי אחריות

### 🤖 Manus - Backend Logic & Data Flow

**תחומי אחריות:**
- ✅ לוגיקה עסקית ב-TypeScript
- ✅ חיבורים ל-Supabase (queries, mutations)
- ✅ State management (useState, useEffect)
- ✅ Data transformation ו-normalization
- ✅ Event handlers מורכבים
- ✅ תיקוני באגים קריטיים
- ✅ אינטגרציות עם APIs חיצוניים

**קבצים שManus אחראי עליהם:**
\`\`\`
app/
  ├── page.tsx                    # Main actors page - data fetching & handlers
  ├── admin/page.tsx              # Admin approval logic
  ├── projects/page.tsx           # Projects data management
  ├── folders/page.tsx            # Folders data management
  └── actors/[id]/page.tsx        # Actor profile data & edit logic

lib/
  ├── supabase/                   # All Supabase client code
  ├── types.ts                    # TypeScript interfaces
  └── store.ts                    # State management

components/
  ├── *-dialog.tsx                # Dialog logic & data submission
  └── actor-edit-form.tsx         # Form validation & submission
\`\`\`

---

### 🎨 v0 - UI Components & Styling

**תחומי אחריות:**
- ✅ עיצוב ו-styling (Tailwind classes)
- ✅ רכיבי UI (buttons, cards, layouts)
- ✅ אנימציות ו-transitions
- ✅ Responsive design
- ✅ Accessibility (a11y)
- ✅ Hover effects ו-micro-interactions
- ✅ shadcn/ui components

**קבצים שv0 אחראי עליהם:**
\`\`\`
components/ui/                    # shadcn/ui components
  ├── button.tsx
  ├── card.tsx
  ├── dialog.tsx
  └── ... (all UI primitives)

components/
  ├── app-header.tsx              # Header UI only
  ├── filter-panel.tsx            # Filter UI only
  └── actor-card.tsx              # Card UI only (NOT handlers)

client/src/
  └── index.css                   # Global styles & theme
\`\`\`

---

## 🚦 כללי עבודה

### כלל 1: תמיד עשה Pull לפני שינויים
\`\`\`bash
cd v0-casting-database-web-app
git pull origin main
\`\`\`

### כלל 2: הודע על שינויים מתוכננים
לפני שמתחילים לעבוד על קובץ, **תמיד** תודיע:
- **Manus → משתמש:** "אני מתחיל לעבוד על `app/page.tsx` - תיקון handleAddToProject"
- **משתמש → v0:** "Manus עובד על app/page.tsx, אל תגע בקובץ הזה עכשיו"

### כלל 3: עבוד על קבצים נפרדים במקביל
אם צריך לעבוד במקביל:
- **Manus:** עובד על `app/page.tsx` (logic)
- **v0:** עובד על `components/actor-card.tsx` (UI)
- ✅ אין התנגשות כי זה קבצים שונים

### כלל 4: אם יש התנגשות - Manus מנצח
אם שני הצדדים שינו את אותו קובץ:
1. Manus עושה `git pull --rebase`
2. Manus פותר את הקונפליקט
3. Manus שומר את השינויים של v0 ב-UI
4. Manus שומר את השינויים שלו ב-logic
5. Manus דוחף commit מאוחד

---

## 📝 צ'קליסט לפני Push

### עבור Manus:
- [ ] ✅ עשיתי `git pull origin main`
- [ ] ✅ בדקתי שאין קונפליקטים
- [ ] ✅ הרצתי `pnpm check` (TypeScript)
- [ ] ✅ בדקתי שהאתר עובד ב-browser
- [ ] ✅ Commit message ברור: `fix: add project dialog implementation`
- [ ] ✅ דחפתי: `git push origin main`

### עבור v0 (דרך המשתמש):
- [ ] ✅ המשתמש עשה `git pull` לפני שביקש מ-v0 שינויים
- [ ] ✅ v0 עבד רק על UI/styling
- [ ] ✅ v0 לא שינה event handlers או data fetching
- [ ] ✅ המשתמש בדק שהעיצוב נראה טוב
- [ ] ✅ v0 דחף את השינויים

---

## 🔄 תרחישי עבודה נפוצים

### תרחיש 1: הוספת פיצ'ר חדש (Dialog להוספה לפרויקט)

**שלב 1 - Manus:**
1. יוצר את `components/add-to-project-dialog.tsx`
2. מוסיף את ה-logic: data fetching, form submission, error handling
3. מחבר ל-`app/page.tsx` דרך `handleAddToProject`
4. Push commit: `feat: add project dialog with data logic`

**שלב 2 - v0:**
1. Pull את השינויים של Manus
2. פותח את `components/add-to-project-dialog.tsx`
3. משפר את העיצוב: colors, spacing, animations
4. מוסיף hover effects וtransitions
5. Push commit: `style: improve project dialog UI`

---

### תרחיש 2: תיקון באג בכרטיס שחקן

**אם הבאג הוא ב-UI (כפתור לא נראה):**
→ **v0 מתקן** (styling issue)

**אם הבאג הוא ב-logic (כפתור לא עובד):**
→ **Manus מתקן** (event handler issue)

**אם שניהם צריכים תיקון:**
1. **Manus מתקן קודם** את ה-logic
2. **v0 מתקן אחר כך** את ה-UI

---

### תרחיש 3: v0 דחף commit שדורס את Manus

**מה קרה:**
- Manus דחף commit `abc123` עם תיקון logic
- v0 דחף commit `def456` עם שינויי UI, אבל מחק בטעות את ה-logic של Manus

**פתרון:**
\`\`\`bash
# Manus עושה:
cd v0-casting-database-web-app
git pull origin main
git log --oneline  # מוצא את commit abc123

# אם v0 דרס לגמרי:
git revert def456  # מבטל את v0
git cherry-pick abc123  # מחזיר את Manus
# עכשיו מוסיף ידנית את השינויים של v0 שהיו טובים

git push origin main
\`\`\`

---

## 🎯 דוגמה מעשית: משימה #1 (Dialog להוספה לפרויקט)

### Manus יעשה:

**קבצים שייגע בהם:**
- `components/quick-add-to-project-dialog.tsx` (יצירה חדשה)
- `app/page.tsx` (שינוי `handleAddToProject`)

**קוד שיכתוב:**
\`\`\`typescript
// components/quick-add-to-project-dialog.tsx
export function QuickAddToProjectDialog({ actor, open, onOpenChange }: Props) {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProject, setSelectedProject] = useState("");
  const [roleName, setRoleName] = useState("");

  useEffect(() => {
    async function loadProjects() {
      const supabase = createClient();
      const { data } = await supabase.from("casting_projects").select("*");
      if (data) setProjects(data);
    }
    if (open) loadProjects();
  }, [open]);

  const handleSubmit = async () => {
    const supabase = createClient();
    await supabase.from("project_actors").insert({
      project_id: selectedProject,
      actor_id: actor.id,
      role_name: roleName
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {/* UI structure - v0 will style this */}
    </Dialog>
  );
}
\`\`\`

---

### v0 יעשה (אחרי ש-Manus סיים):

**קבצים שייגע בהם:**
- `components/quick-add-to-project-dialog.tsx` (styling בלבד)

**קוד שישנה:**
\`\`\`typescript
// v0 מוסיף רק classes ו-styling:
return (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-[500px] bg-gradient-to-br from-blue-50 to-white">
      <DialogHeader>
        <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-green-600 bg-clip-text text-transparent">
          הוסף לפרויקט
        </DialogTitle>
      </DialogHeader>
      <div className="space-y-4 py-4">
        <Select value={selectedProject} onValueChange={setSelectedProject}>
          <SelectTrigger className="hover:border-primary transition-colors">
            {/* ... */}
          </SelectTrigger>
        </Select>
        <Input 
          className="hover:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          // ... 
        />
      </div>
      <DialogFooter>
        <Button 
          onClick={handleSubmit}
          className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700 transition-all shadow-lg hover:shadow-xl"
        >
          הוסף
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);
\`\`\`

**שים לב:** v0 **לא** שינה:
- ❌ את ה-`useState`
- ❌ את ה-`useEffect`
- ❌ את ה-`handleSubmit`
- ❌ את ה-props

v0 רק הוסיף:
- ✅ `className` attributes
- ✅ Tailwind classes
- ✅ Hover effects
- ✅ Transitions

---

## 📊 טבלת החלטה מהירה

| שאלה | Manus | v0 |
| :--- | :---: | :---: |
| צריך לשנות `useState`? | ✅ | ❌ |
| צריך לשנות `useEffect`? | ✅ | ❌ |
| צריך לשנות event handler? | ✅ | ❌ |
| צריך לשנות Supabase query? | ✅ | ❌ |
| צריך להוסיף `className`? | ❌ | ✅ |
| צריך לשנות colors? | ❌ | ✅ |
| צריך להוסיף animation? | ❌ | ✅ |
| צריך לתקן responsive? | ❌ | ✅ |
| צריך להוסיף hover effect? | ❌ | ✅ |
| צריך לתקן TypeScript error? | ✅ | ❌ |
| צריך לתקן layout bug? | ❌ | ✅ |

---

## 🚨 אזהרות

### ⚠️ v0 לעולם לא צריך לגעת ב:
- `import { createClient } from "@/lib/supabase/client"`
- `const supabase = createClient()`
- `await supabase.from(...)`
- `useState`, `useEffect`, `useCallback`
- `const handle... = async () => { ... }`
- `if (error) { ... }`

### ⚠️ Manus לעולם לא צריך לגעת ב:
- `className="..."`  (אלא אם זה חדש לגמרי)
- `hover:...`, `transition-...`, `animate-...`
- `bg-gradient-...`, `shadow-...`
- `sm:`, `md:`, `lg:` (responsive breakpoints)

---

## ✅ סיכום

**כלל הזהב:**
> Manus = מוח (Logic)  
> v0 = עיניים (UI)

**תהליך אידיאלי:**
1. משתמש מבקש פיצ'ר
2. Manus בונה את ה-logic
3. Manus דוחף commit
4. משתמש עושה pull
5. משתמש מבקש מ-v0 לשפר UI
6. v0 משפר styling
7. v0 דוחף commit
8. ✅ הכל עובד!

**אם יש בעיה:**
→ Manus פותר את הקונפליקט  
→ Manus שומר את שני הצדדים  
→ Manus דוחף commit מאוחד
