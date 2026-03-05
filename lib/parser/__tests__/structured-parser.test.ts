import { describe, it, expect } from "vitest"
import {
  autoDetectColumns,
  parseScriptLinesFromStructuredData,
  extractDialogueLines,
  splitInCellCharacter,
  parseCompChangeCell,
  type StructuredParseResult,
} from "../structured-parser"

// ─── autoDetectColumns ────────────────────────────────────────────────────────

describe("autoDetectColumns", () => {
  it("detects timecode column", () => {
    const result = autoDetectColumns(["Timecode", "Character", "Dialogue"])
    expect(result.timecodeColumn).toBe("Timecode")
  })

  it("detects TC alias", () => {
    const result = autoDetectColumns(["TC", "Role", "Text"])
    expect(result.timecodeColumn).toBe("TC")
  })

  it("detects role name column (Character)", () => {
    const result = autoDetectColumns(["Timecode", "Character", "Dialogue"])
    expect(result.roleNameColumn).toBe("Character")
  })

  it("detects Hebrew role column (דמות)", () => {
    const result = autoDetectColumns(["TC", "דמות", "עברית"])
    expect(result.roleNameColumn).toBe("דמות")
  })

  it("detects Hebrew role column (תפקיד)", () => {
    const result = autoDetectColumns(["תפקיד", "עברית", "הערות"])
    expect(result.roleNameColumn).toBe("תפקיד")
  })

  it("detects translation column (עברית)", () => {
    const result = autoDetectColumns(["TC", "Role", "Dialogue", "עברית"])
    expect(result.translationColumn).toBe("עברית")
  })

  it("detects source text column (English)", () => {
    const result = autoDetectColumns(["TC", "Char", "English", "Hebrew"])
    expect(result.sourceTextColumn).toBe("English")
  })

  it("detects rec status column", () => {
    const result = autoDetectColumns(["TC", "Char", "Rec"])
    expect(result.recStatusColumn).toBe("Rec")
  })

  it("detects notes column (הערות)", () => {
    const result = autoDetectColumns(["Role", "Text", "הערות"])
    expect(result.notesColumn).toBe("הערות")
  })

  it("returns empty string for roleNameColumn when not found", () => {
    const result = autoDetectColumns(["Col1", "Col2", "Col3"])
    expect(result.roleNameColumn).toBe("")
  })

  it("is case-insensitive", () => {
    const result = autoDetectColumns(["TIMECODE", "ROLE", "DIALOGUE"])
    expect(result.timecodeColumn).toBe("TIMECODE")
    expect(result.roleNameColumn).toBe("ROLE")
    expect(result.sourceTextColumn).toBe("DIALOGUE")
  })
})

// ─── parseScriptLinesFromStructuredData ───────────────────────────────────────

describe("parseScriptLinesFromStructuredData", () => {
  const makeResult = (rows: Record<string, string | number | null>[]): StructuredParseResult => ({
    headers: Object.keys(rows[0] ?? {}),
    rows,
    source: "docx-table",
    totalRows: rows.length,
  })

  it("converts rows to ScriptLineInput[]", () => {
    const data = makeResult([
      { TC: "00:01:00", Character: "JOHN", Text: "Hello", Translation: "שלום" },
      { TC: "00:01:05", Character: "MARY", Text: "Hi", Translation: "היי" },
    ])
    const lines = parseScriptLinesFromStructuredData(data, {
      timecodeColumn: "TC",
      roleNameColumn: "Character",
      sourceTextColumn: "Text",
      translationColumn: "Translation",
    })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({
      line_number: 1,
      timecode: "00:01:00",
      role_name: "JOHN",
      source_text: "Hello",
      translation: "שלום",
    })
    expect(lines[1]).toMatchObject({
      line_number: 2,
      role_name: "MARY",
    })
  })

  it("skips rows with empty role_name by default", () => {
    const data = makeResult([
      { Character: "JOHN", Text: "Hello" },
      { Character: "", Text: "..." },
      { Character: "MARY", Text: "Hi" },
    ])
    const lines = parseScriptLinesFromStructuredData(data, { roleNameColumn: "Character" })
    expect(lines).toHaveLength(2)
  })

  it("includes empty-role rows when skipEmptyRole=false", () => {
    const data = makeResult([
      { Character: "JOHN", Text: "Hello" },
      { Character: "", Text: "..." },
    ])
    const lines = parseScriptLinesFromStructuredData(data, {
      roleNameColumn: "Character",
      skipEmptyRole: false,
    })
    expect(lines).toHaveLength(2)
    expect(lines[1].role_name).toBe("")
  })

  it("normalises rec_status to valid RecStatus values", () => {
    const data = makeResult([
      { Role: "JOHN", Status: "הוקלט" },
      { Role: "MARY", Status: "לא הוקלט" },
      { Role: "BOB", Status: "Optional" },
      { Role: "ALICE", Status: "invalid" },
    ])
    const lines = parseScriptLinesFromStructuredData(data, {
      roleNameColumn: "Role",
      recStatusColumn: "Status",
    })
    expect(lines[0].rec_status).toBe("הוקלט")
    expect(lines[1].rec_status).toBe("לא הוקלט")
    expect(lines[2].rec_status).toBe("Optional")
    expect(lines[3].rec_status).toBeNull()
  })

  it("assigns sequential line numbers", () => {
    const data = makeResult([
      { Role: "A" },
      { Role: "B" },
      { Role: "C" },
    ])
    const lines = parseScriptLinesFromStructuredData(data, { roleNameColumn: "Role" })
    expect(lines.map((l) => l.line_number)).toEqual([1, 2, 3])
  })

  it("handles null cell values gracefully", () => {
    const data = makeResult([
      { Role: "JOHN", TC: null, Text: null },
    ])
    const lines = parseScriptLinesFromStructuredData(data, {
      roleNameColumn: "Role",
      timecodeColumn: "TC",
      sourceTextColumn: "Text",
    })
    expect(lines[0].timecode).toBeUndefined()
    expect(lines[0].source_text).toBeUndefined()
  })

  it("returns empty array for empty rows", () => {
    const data: StructuredParseResult = { headers: ["Role"], rows: [], source: "excel", totalRows: 0 }
    const lines = parseScriptLinesFromStructuredData(data, { roleNameColumn: "Role" })
    expect(lines).toHaveLength(0)
  })
})

// ─── extractDialogueLines ────────────────────────────────────────────────────

describe("extractDialogueLines", () => {
  it("extracts FORMAT A: NAME: dialogue", () => {
    const text = [
      "JOHN: Hello, how are you?",
      "MARY: Fine, thanks.",
    ].join("\n")
    const lines = extractDialogueLines(text)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ role_name: "JOHN", source_text: "Hello, how are you?" })
    expect(lines[1]).toMatchObject({ role_name: "MARY", source_text: "Fine, thanks." })
  })

  it("extracts FORMAT B: NAME then indented dialogue", () => {
    const text = [
      "JOHN",
      "    Hello, how are you?",
      "",
      "MARY",
      "    Fine, thanks.",
    ].join("\n")
    const lines = extractDialogueLines(text)
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ role_name: "JOHN", source_text: "Hello, how are you?" })
    expect(lines[1]).toMatchObject({ role_name: "MARY", source_text: "Fine, thanks." })
  })

  it("joins multi-line indented dialogue", () => {
    const text = [
      "JOHN",
      "    Line one of the",
      "    dialogue here.",
    ].join("\n")
    const lines = extractDialogueLines(text)
    expect(lines).toHaveLength(1)
    expect(lines[0].source_text).toBe("Line one of the dialogue here.")
  })

  it("assigns sequential line numbers", () => {
    const text = [
      "JOHN: First.",
      "MARY: Second.",
      "JOHN: Third.",
    ].join("\n")
    const lines = extractDialogueLines(text)
    expect(lines.map((l) => l.line_number)).toEqual([1, 2, 3])
  })

  it("skips non-matching lines", () => {
    const text = [
      "Some stage direction here.",
      "JOHN: Hello.",
      "Another direction.",
      "MARY: Hi.",
    ].join("\n")
    const lines = extractDialogueLines(text)
    expect(lines).toHaveLength(2)
  })

  it("skips names without following dialogue (Format B)", () => {
    const text = [
      "JOHN",
      "Another scene direction — no indent",
    ].join("\n")
    const lines = extractDialogueLines(text)
    // JOHN has no indented dialogue, should not be extracted
    expect(lines).toHaveLength(0)
  })

  it("returns empty array for empty text", () => {
    expect(extractDialogueLines("")).toHaveLength(0)
    expect(extractDialogueLines("\n\n\n")).toHaveLength(0)
  })

  it("handles mixed formats in the same text", () => {
    const text = [
      "JOHN: Hello.",
      "MARY",
      "    How are you?",
    ].join("\n")
    const lines = extractDialogueLines(text)
    expect(lines).toHaveLength(2)
    expect(lines[0].role_name).toBe("JOHN")
    expect(lines[1].role_name).toBe("MARY")
  })
})

// ─── autoDetectColumns — new patterns ────────────────────────────────────────

describe("autoDetectColumns — extended patterns", () => {
  // Format 3: Word translation table
  it("detects 'Original Version' as sourceTextColumn", () => {
    const result = autoDetectColumns(["Original Version", "Translation"])
    expect(result.sourceTextColumn).toBe("Original Version")
  })

  it("detects 'CONTENT :: DIALOGUE TRANSCRIPTION' as sourceTextColumn (Deluxe Excel)", () => {
    const result = autoDetectColumns([
      "TIMECODE IN",
      "CHARACTER :: SOURCE",
      "CONTENT :: DIALOGUE TRANSCRIPTION",
      "TRANSLATION",
      "ANNOTATIONS",
    ])
    expect(result.sourceTextColumn).toBe("CONTENT :: DIALOGUE TRANSCRIPTION")
  })

  it("detects 'CHARACTER :: SOURCE' as roleNameColumn (Deluxe Excel)", () => {
    const result = autoDetectColumns([
      "TIMECODE IN",
      "CHARACTER :: SOURCE",
      "CONTENT :: DIALOGUE TRANSCRIPTION",
    ])
    expect(result.roleNameColumn).toBe("CHARACTER :: SOURCE")
  })

  it("detects 'TIMECODE IN' as timecodeColumn and not TIMECODE OUT", () => {
    const result = autoDetectColumns(["TIMECODE IN", "TIMECODE OUT", "CHARACTER :: SOURCE"])
    expect(result.timecodeColumn).toBe("TIMECODE IN")
  })

  it("detects 'ANNOTATIONS' as notesColumn", () => {
    const result = autoDetectColumns(["TC", "Char", "Dialogue", "ANNOTATIONS"])
    expect(result.notesColumn).toBe("ANNOTATIONS")
  })

  it("detects 'COMMENTS' as notesColumn", () => {
    const result = autoDetectColumns(["TC IN", "COMP CHANGE DETAILS", "COMMENTS"])
    expect(result.notesColumn).toBe("COMMENTS")
  })

  // Format 4: COMP change list
  it("detects 'COMP CHANGE DETAILS' as compChangeColumn", () => {
    const result = autoDetectColumns(["TC IN", "COMP CHANGE DETAILS", "COMMENTS"])
    expect(result.compChangeColumn).toBe("COMP CHANGE DETAILS")
  })

  it("detects 'Change Details' as compChangeColumn", () => {
    const result = autoDetectColumns(["TC", "Change Details", "Notes"])
    expect(result.compChangeColumn).toBe("Change Details")
  })

  it("detects 'TC IN' as timecodeColumn for COMP list", () => {
    const result = autoDetectColumns(["TC IN", "COMP CHANGE DETAILS", "COMMENTS"])
    expect(result.timecodeColumn).toBe("TC IN")
  })
})

// ─── splitInCellCharacter ────────────────────────────────────────────────────

describe("splitInCellCharacter", () => {
  it("splits 'Gru: Hello everybody.' into role and text", () => {
    const result = splitInCellCharacter("Gru: Hello everybody.")
    expect(result).toEqual({ role_name: "Gru", source_text: "Hello everybody." })
  })

  it("splits 'Edith: Gru, what's up!' correctly", () => {
    const result = splitInCellCharacter("Edith: Gru, what's up!")
    expect(result).toEqual({ role_name: "Edith", source_text: "Gru, what's up!" })
  })

  it("splits multi-word role name 'Snow White: Who are you?'", () => {
    const result = splitInCellCharacter("Snow White: Who are you?")
    expect(result).toEqual({ role_name: "Snow White", source_text: "Who are you?" })
  })

  it("splits 'LUCY/WYLDSTYLE: Come back!'", () => {
    const result = splitInCellCharacter("LUCY/WYLDSTYLE: Come back!")
    expect(result).toEqual({ role_name: "LUCY/WYLDSTYLE", source_text: "Come back!" })
  })

  it("returns null when no colon pattern found", () => {
    expect(splitInCellCharacter("Just some text without a character")).toBeNull()
    expect(splitInCellCharacter("")).toBeNull()
  })

  it("returns null for lowercase names (not a character)", () => {
    expect(splitInCellCharacter("note: this is a stage direction")).toBeNull()
  })
})

// ─── parseScriptLinesFromStructuredData — in-cell extraction ─────────────────

describe("parseScriptLinesFromStructuredData — in-cell character extraction", () => {
  const makeResult = (rows: Record<string, string | null>[]): StructuredParseResult => ({
    headers: Object.keys(rows[0] ?? {}),
    rows,
    source: "docx-table",
    totalRows: rows.length,
  })

  it("extracts role_name from 'Original Version' column when no role column", () => {
    const data = makeResult([
      { "Original Version": "Gru: Hello everybody.", Translation: "גרו: שלום לכולם." },
      { "Original Version": "Lucy: This guy.", Translation: "לוסי: הבחור הזה." },
    ])
    const detected = autoDetectColumns(data.headers)
    const lines = parseScriptLinesFromStructuredData(data, {
      roleNameColumn: detected.roleNameColumn ?? "",
      sourceTextColumn: detected.sourceTextColumn,
      translationColumn: detected.translationColumn,
    })
    expect(lines).toHaveLength(2)
    expect(lines[0]).toMatchObject({ role_name: "Gru", source_text: "Hello everybody." })
    expect(lines[1]).toMatchObject({ role_name: "Lucy", source_text: "This guy." })
  })

  it("skips blank rows in Word table (gray separator rows)", () => {
    const data = makeResult([
      { "Original Version": "Gru: Hello.", Translation: null },
      { "Original Version": null, Translation: null },
      { "Original Version": "Lucy: Hi.", Translation: null },
    ])
    const lines = parseScriptLinesFromStructuredData(data, {
      roleNameColumn: "",
      sourceTextColumn: "Original Version",
    })
    expect(lines).toHaveLength(2)
  })
})

// ─── parseCompChangeCell ──────────────────────────────────────────────────────

describe("parseCompChangeCell", () => {
  it("parses quoted dialogue with action (Pattern A)", () => {
    const result = parseCompChangeCell("03:07:27:10", 'Sneezy "Give it to me" removed')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      role_name: "Sneezy",
      source_text: "Give it to me",
      notes: "removed",
      timecode: "03:07:27:10",
    })
  })

  it("parses frame-offset action (Pattern A with +Xfr)", () => {
    const result = parseCompChangeCell("03:08:18:04", 'Doc "Two hundred and seventy-four" +2fr')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      role_name: "Doc",
      source_text: "Two hundred and seventy-four",
      notes: "+2fr",
    })
  })

  it("parses angle-bracket sound effects (Pattern A with <...>)", () => {
    const result = parseCompChangeCell("03:08:26:07", 'Happy "<chuckles>" removed')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      role_name: "Happy",
      source_text: "<chuckles>",
      notes: "removed",
    })
  })

  it("parses sound effect without dialogue (Pattern B)", () => {
    const result = parseCompChangeCell("03:06:42:00", "Dopey breath added")
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      role_name: "Dopey",
      notes: "breath added",
    })
    expect(result[0].source_text).toBeUndefined()
  })

  it("parses multi-word role name 'Snow White' (Pattern B)", () => {
    const result = parseCompChangeCell("03:12:15:21", "Snow White inhale added")
    expect(result).toHaveLength(1)
    expect(result[0].role_name).toBe("Snow White")
    expect(result[0].source_text).toBeUndefined()
  })

  it("parses slash-combined roles (keeps as single row)", () => {
    const result = parseCompChangeCell("03:12:05:16", 'Sleepy/Grumpy "<groan>" removed')
    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      role_name: "Sleepy/Grumpy",
      source_text: "<groan>",
      notes: "removed",
    })
  })

  it("splits // into multiple rows (Pattern C — multi-character)", () => {
    const result = parseCompChangeCell(
      "03:08:51:14",
      'Grumpy "Get out of there" added // Sneezy "Uh, Miss White" +14fr'
    )
    expect(result).toHaveLength(2)
    expect(result[0]).toMatchObject({ role_name: "Grumpy", source_text: "Get out of there", notes: "added" })
    expect(result[1]).toMatchObject({ role_name: "Sneezy", source_text: "Uh, Miss White", notes: "+14fr" })
  })

  it("includes extraNotes from COMMENTS column", () => {
    const result = parseCompChangeCell("03:07:27:10", 'Sneezy "Give it to me" removed', "see reel 3")
    expect(result[0].notes).toBe("removed; see reel 3")
  })

  it("handles undefined timecode gracefully", () => {
    const result = parseCompChangeCell(undefined, 'Grumpy "text" removed')
    expect(result[0].timecode).toBeUndefined()
  })
})

// ─── parseScriptLinesFromStructuredData — COMP change list mode ───────────────

describe("parseScriptLinesFromStructuredData — COMP change list", () => {
  it("parses a COMP change list PDF table end-to-end", () => {
    const data: StructuredParseResult = {
      headers: ["TC IN", "COMP CHANGE DETAILS", "COMMENTS"],
      rows: [
        { "TC IN": "03:06:42:00", "COMP CHANGE DETAILS": "Dopey breath added", COMMENTS: null },
        { "TC IN": "03:07:27:10", "COMP CHANGE DETAILS": 'Sneezy "Give it to me" removed', COMMENTS: null },
        { "TC IN": "03:08:51:14", "COMP CHANGE DETAILS": 'Grumpy "Get out of there" added // Sneezy "Uh, Miss White" +14fr', COMMENTS: null },
      ],
      source: "pdf-table",
      totalRows: 3,
    }
    const detected = autoDetectColumns(data.headers)
    const lines = parseScriptLinesFromStructuredData(data, {
      roleNameColumn: detected.roleNameColumn ?? "",
      timecodeColumn: detected.timecodeColumn,
      compChangeColumn: detected.compChangeColumn,
      notesColumn: detected.notesColumn,
    })
    // Row 1: Dopey breath added
    // Row 2: Sneezy "Give it to me" removed
    // Row 3: expands to 2 rows (Grumpy + Sneezy)
    expect(lines).toHaveLength(4)
    expect(lines[0]).toMatchObject({ timecode: "03:06:42:00", role_name: "Dopey" })
    expect(lines[1]).toMatchObject({ timecode: "03:07:27:10", role_name: "Sneezy", source_text: "Give it to me" })
    expect(lines[2]).toMatchObject({ role_name: "Grumpy", source_text: "Get out of there" })
    expect(lines[3]).toMatchObject({ role_name: "Sneezy", source_text: "Uh, Miss White" })
    // line_numbers should be sequential
    expect(lines.map((l) => l.line_number)).toEqual([1, 2, 3, 4])
  })
})
