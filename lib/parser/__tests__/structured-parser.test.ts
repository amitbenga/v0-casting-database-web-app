import { describe, it, expect } from "vitest"
import {
  autoDetectColumns,
  parseScriptLinesFromStructuredData,
  extractDialogueLines,
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
