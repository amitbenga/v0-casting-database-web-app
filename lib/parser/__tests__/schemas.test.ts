import { describe, it, expect } from "vitest"
import {
  ScriptLineInputSchema,
  TimecodeSchema,
  RecStatusSchema,
  StructuredParseResultSchema,
  StructuredColumnMappingSchema,
  validateScriptLines,
  validateStructuredResult,
  validateColumnMapping,
} from "../schemas"

// ─── TimecodeSchema ──────────────────────────────────────────────────────────

describe("TimecodeSchema", () => {
  it("accepts HH:MM:SS", () => {
    expect(TimecodeSchema.safeParse("01:23:45").success).toBe(true)
  })

  it("accepts HH:MM:SS:FF", () => {
    expect(TimecodeSchema.safeParse("01:23:45:10").success).toBe(true)
  })

  it("accepts single-digit hours", () => {
    expect(TimecodeSchema.safeParse("0:01:23").success).toBe(true)
  })

  it("rejects invalid format", () => {
    expect(TimecodeSchema.safeParse("hello").success).toBe(false)
    expect(TimecodeSchema.safeParse("1234").success).toBe(false)
    expect(TimecodeSchema.safeParse("").success).toBe(false)
  })

  it("rejects partial timecodes", () => {
    expect(TimecodeSchema.safeParse("01:23").success).toBe(false)
  })
})

// ─── RecStatusSchema ─────────────────────────────────────────────────────────

describe("RecStatusSchema", () => {
  it("accepts valid Hebrew status values", () => {
    expect(RecStatusSchema.safeParse("הוקלט").success).toBe(true)
    expect(RecStatusSchema.safeParse("לא הוקלט").success).toBe(true)
    expect(RecStatusSchema.safeParse("Optional").success).toBe(true)
  })

  it("rejects invalid values", () => {
    expect(RecStatusSchema.safeParse("done").success).toBe(false)
    expect(RecStatusSchema.safeParse("").success).toBe(false)
  })
})

// ─── ScriptLineInputSchema ───────────────────────────────────────────────────

describe("ScriptLineInputSchema", () => {
  it("accepts a valid complete line", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: 1,
      role_name: "JOHN",
      timecode: "00:01:23",
      source_text: "Hello",
      translation: "שלום",
      rec_status: "הוקלט",
      notes: "First take",
    })
    expect(result.success).toBe(true)
  })

  it("accepts minimal line (only required fields)", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: 1,
      role_name: "JOHN",
    })
    expect(result.success).toBe(true)
  })

  it("rejects missing role_name", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: 1,
    })
    expect(result.success).toBe(false)
  })

  it("rejects empty role_name", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: 1,
      role_name: "",
    })
    expect(result.success).toBe(false)
  })

  it("rejects zero line_number", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: 0,
      role_name: "JOHN",
    })
    expect(result.success).toBe(false)
  })

  it("rejects negative line_number", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: -1,
      role_name: "JOHN",
    })
    expect(result.success).toBe(false)
  })

  it("accepts null rec_status", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: 1,
      role_name: "JOHN",
      rec_status: null,
    })
    expect(result.success).toBe(true)
  })

  it("rejects invalid rec_status", () => {
    const result = ScriptLineInputSchema.safeParse({
      line_number: 1,
      role_name: "JOHN",
      rec_status: "invalid",
    })
    expect(result.success).toBe(false)
  })
})

// ─── validateScriptLines ─────────────────────────────────────────────────────

describe("validateScriptLines", () => {
  it("validates all valid lines", () => {
    const result = validateScriptLines([
      { line_number: 1, role_name: "JOHN", source_text: "Hello" },
      { line_number: 2, role_name: "MARY", source_text: "Hi" },
    ])
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(2)
    expect(result.rejected).toHaveLength(0)
  })

  it("rejects invalid lines while keeping valid ones", () => {
    const result = validateScriptLines([
      { line_number: 1, role_name: "JOHN" },
      { line_number: -1, role_name: "BAD" }, // invalid
      { line_number: 3, role_name: "" }, // invalid — empty name
      { line_number: 4, role_name: "MARY" },
    ])
    expect(result.success).toBe(false)
    expect(result.data).toHaveLength(2) // JOHN + MARY
    expect(result.rejected).toHaveLength(2)
  })

  it("returns diagnostics for rejected lines", () => {
    const result = validateScriptLines([
      { line_number: 0, role_name: "X" },
    ])
    expect(result.diagnostics.length).toBeGreaterThan(0)
    expect(result.diagnostics[0].severity).toBe("error")
  })

  it("handles empty array", () => {
    const result = validateScriptLines([])
    expect(result.success).toBe(true)
    expect(result.data).toHaveLength(0)
  })
})

// ─── validateStructuredResult ────────────────────────────────────────────────

describe("validateStructuredResult", () => {
  it("validates a correct result", () => {
    const result = validateStructuredResult({
      headers: ["TC", "Character", "Dialogue"],
      rows: [{ TC: "00:01:00", Character: "JOHN", Dialogue: "Hello" }],
      source: "excel",
      totalRows: 1,
    })
    expect(result.success).toBe(true)
  })

  it("warns on totalRows mismatch", () => {
    const result = validateStructuredResult({
      headers: ["A"],
      rows: [{ A: "1" }, { A: "2" }],
      source: "docx-table",
      totalRows: 99,
    })
    expect(result.success).toBe(true)
    expect(result.diagnostics.some((d) => d.message.includes("totalRows"))).toBe(true)
  })

  it("warns on duplicate headers", () => {
    const result = validateStructuredResult({
      headers: ["Role", "Role"],
      rows: [{ Role: "JOHN" }],
      source: "pdf-table",
      totalRows: 1,
    })
    expect(result.diagnostics.some((d) => d.message.includes("כפולה"))).toBe(true)
  })

  it("rejects empty headers", () => {
    const result = validateStructuredResult({
      headers: [],
      rows: [],
      source: "excel",
      totalRows: 0,
    })
    expect(result.success).toBe(false)
  })

  it("rejects invalid source type", () => {
    const result = validateStructuredResult({
      headers: ["A"],
      rows: [],
      source: "invalid",
      totalRows: 0,
    })
    expect(result.success).toBe(false)
  })
})

// ─── validateColumnMapping ───────────────────────────────────────────────────

describe("validateColumnMapping", () => {
  it("returns no diagnostics for valid mapping", () => {
    const diags = validateColumnMapping(
      { roleNameColumn: "Character", timecodeColumn: "TC" },
      ["TC", "Character", "Dialogue"]
    )
    expect(diags).toHaveLength(0)
  })

  it("returns error for non-existent column", () => {
    const diags = validateColumnMapping(
      { roleNameColumn: "NonExistent" },
      ["TC", "Character", "Dialogue"]
    )
    expect(diags.length).toBeGreaterThan(0)
    expect(diags[0].severity).toBe("error")
  })

  it("returns error for empty roleNameColumn", () => {
    const diags = validateColumnMapping(
      { roleNameColumn: "" },
      ["TC", "Character"]
    )
    expect(diags.length).toBeGreaterThan(0)
  })
})
