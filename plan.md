# תוכנית שדרוג מערכת הפרסור — תמיכה ב-PDF, DOCX, Excel לחילוץ תפקידים + סביבת עבודה

## מצב קיים — הפער

### מה עובד היום:
| פעולה | Excel | PDF | DOCX | TXT |
|--------|-------|-----|------|-----|
| **חילוץ תפקידים** (casting) | ✅ | ✅ regex | ✅ regex | ✅ regex |
| **שורות לסביבת עבודה** (timecode, דיאלוג, תרגום) | ✅ מלא | ❌ רק stubs | ❌ רק stubs | ❌ רק stubs |

### הבעיה:
- כשמעלים PDF/DOCX של תסריט דיבוב (שלרוב הוא **טבלאי** — עם TC, דמות, דיאלוג, תרגום), המערכת מריצה רק את ה-regex parser שמחלץ **שמות תפקידים בלבד**
- סביבת העבודה מקבלת stubs ריקים (role_name + line_number) — **בלי timecode, בלי טקסט מקור, בלי תרגום**
- ייבוא שורות מפורט אפשרי **רק מ-Excel** דרך הדיאלוג הירוק

### היעד:
| פעולה | Excel | PDF | DOCX | TXT |
|--------|-------|-----|------|-----|
| **חילוץ תפקידים** | ✅ | ✅ | ✅ | ✅ |
| **שורות לסביבת עבודה** | ✅ | ✅ טבלאות | ✅ טבלאות | ✅ פורמט NAME: |

---

## ארכיטקטורה — הגישה

### עקרון מרכזי: "StructuredParseResult" — פורמט אחיד לכל מקור טבלאי

כל extractor (Excel, PDF, DOCX) מייצר אותו פורמט:
```typescript
interface StructuredParseResult {
  headers: string[]
  rows: Record<string, string | number | null>[]
  source: "excel" | "pdf-table" | "docx-table" | "text-tabular"
  sheetName?: string
  totalRows: number
}
```

הפונקציות `autoDetectScriptLineColumns` ו-`parseScriptLinesFromExcel` מוכללות לעבוד עם `StructuredParseResult` — אותה לוגיקה, כל מקור נתונים.

### זרימה חדשה:
```
קובץ נכנס
    ↓
detectContentType(file) → "tabular" | "screenplay" | "hybrid"
    ↓
┌─ tabular ────→ extractStructuredData(file) → StructuredParseResult
│                    ↓
│                autoDetectScriptLineColumns(headers)
│                    ↓
│                parseScriptLinesFromStructuredData(result, mapping) → ScriptLineInput[]
│                    ↓
│                [גם] extractRolesFromStructuredData(result) → ExtractedCharacter[]
│
├─ screenplay ─→ extractText → normalizeText → parseScript (regex) → roles
│                    ↓
│                [חדש] extractDialogueFromText(text) → ScriptLineInput[] (partial)
│
└─ hybrid ─────→ שני המסלולים — תפקידים מ-regex + שורות מטבלה
```

---

## שלבי מימוש

### שלב 1: PDF Table Extraction
**קובץ:** `lib/parser/text-extractor.ts` — פונקציה חדשה `extractTablesFromPDF`

**איך זה עובד (בלי LLM):**
- PDF.js כבר מחזיר `x, y` coordinates לכל פריט טקסט
- **Column detection:** מנתחים את ה-x positions של כל הטקסט בדף — ערכים שחוזרים על עצמם = גבולות עמודות
- **Row detection:** קיבוץ לפי y position (כבר קיים בקוד הנוכחי!)
- **Header detection:** השורה הראשונה או השורה עם הכי הרבה עמודות מלאות
- **Multi-page:** איחוד טבלאות שנמשכות על פני עמודים

**Heuristic לזיהוי טבלה ב-PDF:**
- ≥3 עמודות עקביות (x positions חוזרים)
- שורות עם מספר שדות אחיד
- נוכחות של timecodes (regex: `\d{1,2}:\d{2}:\d{2}`)

### שלב 2: DOCX Table Extraction
**קובץ:** `lib/parser/text-extractor.ts` — פונקציה חדשה `extractTablesFromDOCX`

**איך זה עובד:**
- DOCX הוא ZIP עם XML
- Word XML מכיל תגיות מפורשות: `<w:tbl>`, `<w:tr>` (שורה), `<w:tc>` (תא)
- פשוט לפרסר — כבר יש גישה ל-XML ב-`extractTextFromDOCX`
- חילוץ headers מהשורה הראשונה של הטבלה
- כל שורה הופכת ל-`Record<header, value>`

### שלב 3: Content Type Detection
**קובץ חדש:** `lib/parser/content-detector.ts`

**Heuristics (בלי LLM):**
```
isTabular IF:
  - PDF: ≥3 עמודות aligned + ≥10 שורות
  - DOCX: יש <w:tbl> עם ≥5 שורות
  - TXT: >50% שורות עם tabs/delimiter קבוע

isScreenplay IF:
  - יש שורות centered (leading spaces)
  - שמות באותיות גדולות + דיאלוג מוזח
  - character:dialogue ratio > 0.1

isHybrid IF:
  - יש גם טבלה וגם טקסט חופשי
```

### שלב 4: Generalize Structured Data Pipeline
**קובץ:** `lib/parser/excel-parser.ts` → `lib/parser/structured-parser.ts`

**שינויים:**
- `autoDetectScriptLineColumns` — כבר גנרי, עובד עם `string[]` headers
- `parseScriptLinesFromExcel` → `parseScriptLinesFromStructuredData` — פרמטר `StructuredParseResult` במקום `ExcelParseResult`
- Backward-compatible: `parseScriptLinesFromExcel` הופך ל-wrapper

### שלב 5: Text-based Script Line Extraction
**קובץ:** `lib/parser/structured-parser.ts`

**לקבצים בפורמט dialogue (לא טבלאי):**
```
JOHN: Hello, how are you?
MARY: I'm fine, thank you.
```
או פורמט screenplay:
```
JOHN
    Hello, how are you?

MARY
    I'm fine, thank you.
```

**הפונקציה `extractDialogueLines(text)`:**
- מזהה NAME: dialogue patterns
- מזהה NAME\n indented-dialogue patterns
- מייצרת `ScriptLineInput[]` עם role_name + source_text

### שלב 6: Pipeline Update
**קובץ:** `lib/parser/index.ts`

**שינויים ב-`parseScriptFiles`:**
- הוספת detection step — `detectContentType`
- אם tabular → חילוץ structured data + שמירת `scriptLines` ב-bundle
- אם screenplay → flow קיים + dialogue extraction
- הוספת `scriptLines?: ScriptLineInput[]` ל-`ParsedScriptBundle`

```typescript
interface ParsedScriptBundle {
  // ... existing fields
  scriptLines?: ScriptLineInput[]  // NEW — שורות מפורטות אם הקובץ טבלאי
  contentType: "tabular" | "screenplay" | "hybrid"  // NEW
}
```

### שלב 7: UI Updates
**קבצים:** `scripts-tab.tsx`, `script-lines-import-dialog.tsx`

**שינויים:**
- כשמעלים PDF/DOCX וזוהה פורמט טבלאי → מציגים את **דיאלוג מיפוי העמודות** (אותו דיאלוג כמו Excel, מוכלל)
- כש-`ParsedScriptBundle` מכיל `scriptLines` → ייבוא אוטומטי לסביבת עבודה
- הוספת אינדיקציה UI: "זוהה תסריט טבלאי — שורות מפורטות יובאו לסביבת העבודה"
- הרחבת `accept` ב-file input (כבר תומך ב-PDF/DOCX/TXT)

---

## קבצים שישתנו

| קובץ | שינוי |
|------|-------|
| `lib/parser/text-extractor.ts` | הוספת `extractTablesFromPDF`, `extractTablesFromDOCX` |
| `lib/parser/structured-parser.ts` | **חדש** — `StructuredParseResult`, `parseScriptLinesFromStructuredData`, `extractDialogueLines` |
| `lib/parser/content-detector.ts` | **חדש** — `detectContentType` |
| `lib/parser/excel-parser.ts` | Refactor — delegates to structured-parser, backward-compat wrappers |
| `lib/parser/index.ts` | Pipeline update — content detection + dual output |
| `lib/types.ts` | הוספת `StructuredParseResult`, הרחבת `ParsedScriptBundle` |
| `components/projects/scripts-tab.tsx` | עדכון flow — column mapping לכל format |
| `components/projects/script-lines-import-dialog.tsx` | Generalize — עובד עם `StructuredParseResult` (לא רק Excel) |
| `lib/parser/__tests__/structured-parser.test.ts` | **חדש** — טסטים ל-PDF tables, DOCX tables, dialogue extraction |
| `lib/parser/__tests__/content-detector.test.ts` | **חדש** — טסטים ל-content type detection |

## מה לא משתנה
- `script-parser.ts` — ה-regex parser לא נפגע
- `fuzzy-matcher.ts` — ללא שינוי
- Pipeline קיים ל-screenplay — עובד כמו היום
- `parseExcelFile` — API נשאר אותו דבר (wrapper)
- כל 77 הטסטים הקיימים — חייבים לעבור

---

## סיכונים וטיפול

| סיכון | טיפול |
|--------|--------|
| PDF tables שלא מזוהים (layout מורכב) | Fallback ל-regex parser + אזהרה למשתמש |
| DOCX ללא טבלאות — רק paragraphs | Fallback ל-text extraction → dialogue lines |
| ביצועים — PDF.js x/y analysis | מוגבל ל-100 עמודות/1000 שורות בדף |
| שבירת Excel flow קיים | Backward-compatible wrappers |

---

## ללא LLM — מה אנחנו מרוויחים

בלי LLM אנחנו מקבלים:
1. **PDF tables** — 80-90% accuracy על PDFs עם מבנה טבלאי ברור
2. **DOCX tables** — 95%+ accuracy כי XML מפורש
3. **Dialogue patterns** — NAME: text format detection
4. **Auto-column detection** — כבר קיים, מורחב לכל format
5. **Timecode detection** — regex patterns

מה עדיין חסר (עתידי עם LLM):
- PDFs סרוקים (תמונות) — צריך OCR
- PDFs עם layout מורכב מאוד (multiple tables, floating text)
- זיהוי שפה אוטומטי (source vs translation)
- תיקון שגיאות כתיב בשמות תפקידים
