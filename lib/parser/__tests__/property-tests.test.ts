/**
 * Property-based tests for the parser pipeline.
 *
 * Uses fast-check to generate random inputs and verify invariants:
 *   - autoDetectColumns never crashes on arbitrary headers
 *   - parseScriptLinesFromStructuredData produces sequential line numbers
 *   - normalizeText is idempotent (running twice gives the same result)
 *   - extractDialogueLines never crashes on arbitrary text
 *   - ScriptLineInputSchema rejects truly invalid data
 */

import { describe, it, expect } from "vitest"
import fc from "fast-check"
import { autoDetectColumns, parseScriptLinesFromStructuredData, extractDialogueLines, type StructuredParseResult } from "../structured-parser"
import { normalizeText } from "../text-extractor"
import { ScriptLineInputSchema, validateScriptLines } from "../schemas"
import { detectContentType } from "../content-detector"
import { tokenize } from "../tokenizer"

// ─── autoDetectColumns ────────────────────────────────────────────────────────

describe("property: autoDetectColumns", () => {
  it("never throws on arbitrary header arrays", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 50 }), { minLength: 0, maxLength: 20 }),
        (headers) => {
          const result = autoDetectColumns(headers)
          expect(result).toBeDefined()
          // roleNameColumn is always a string (never undefined)
          expect(typeof result.roleNameColumn).toBe("string")
        }
      ),
      { numRuns: 200 }
    )
  })

  it("detects role column when present", () => {
    fc.assert(
      fc.property(
        fc.constantFrom("Character", "ROLE", "תפקיד", "דמות", "char"),
        fc.array(fc.string({ minLength: 1, maxLength: 20 }), { minLength: 0, maxLength: 5 }),
        (roleHeader, otherHeaders) => {
          const headers = [...otherHeaders, roleHeader]
          const result = autoDetectColumns(headers)
          expect(result.roleNameColumn).toBeTruthy()
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── parseScriptLinesFromStructuredData ───────────────────────────────────────

describe("property: parseScriptLinesFromStructuredData", () => {
  it("produces sequential line numbers starting at 1", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            Role: fc.string({ minLength: 1, maxLength: 20 }),
            Text: fc.string({ minLength: 0, maxLength: 100 }),
          }),
          { minLength: 1, maxLength: 50 }
        ),
        (rows) => {
          const result: StructuredParseResult = {
            headers: ["Role", "Text"],
            rows,
            source: "excel",
            totalRows: rows.length,
          }
          const lines = parseScriptLinesFromStructuredData(result, {
            roleNameColumn: "Role",
            sourceTextColumn: "Text",
          })
          // Line numbers should be sequential
          for (let i = 0; i < lines.length; i++) {
            expect(lines[i].line_number).toBe(i + 1)
          }
        }
      ),
      { numRuns: 100 }
    )
  })

  it("never produces more lines than input rows", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            Role: fc.oneof(fc.string({ minLength: 0, maxLength: 20 }), fc.constant("")),
          }),
          { minLength: 0, maxLength: 50 }
        ),
        (rows) => {
          const result: StructuredParseResult = {
            headers: ["Role"],
            rows,
            source: "pdf-table",
            totalRows: rows.length,
          }
          const lines = parseScriptLinesFromStructuredData(result, {
            roleNameColumn: "Role",
          })
          expect(lines.length).toBeLessThanOrEqual(rows.length)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── normalizeText ───────────────────────────────────────────────────────────

describe("property: normalizeText", () => {
  it("is idempotent (normalize(normalize(x)) === normalize(x))", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (text) => {
          const once = normalizeText(text)
          const twice = normalizeText(once)
          expect(twice).toBe(once)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("never increases line count by more than 2x (speaker-colon expansion)", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (text) => {
          const inputLines = text.split("\n").length
          const outputLines = normalizeText(text).split("\n").length
          // Speaker-colon expansion can at most double the line count
          expect(outputLines).toBeLessThanOrEqual(inputLines * 2 + 1)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("removes bidi control characters", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 100 }),
        (text) => {
          // Inject some bidi chars
          const withBidi = "\u200E" + text + "\u200F\u202A"
          const result = normalizeText(withBidi)
          expect(result).not.toContain("\u200E")
          expect(result).not.toContain("\u200F")
          expect(result).not.toContain("\u202A")
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── extractDialogueLines ────────────────────────────────────────────────────

describe("property: extractDialogueLines", () => {
  it("never crashes on arbitrary text", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1000 }),
        (text) => {
          const result = extractDialogueLines(text)
          expect(Array.isArray(result)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("produces sequential line numbers", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 500 }),
        (text) => {
          const lines = extractDialogueLines(text)
          for (let i = 0; i < lines.length; i++) {
            expect(lines[i].line_number).toBe(i + 1)
          }
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── ScriptLineInputSchema ──────────────────────────────────────────────────

describe("property: ScriptLineInputSchema", () => {
  it("always rejects lines with non-positive line_number", () => {
    fc.assert(
      fc.property(
        fc.integer({ max: 0 }),
        fc.string({ minLength: 1, maxLength: 20 }),
        (lineNum, name) => {
          const result = ScriptLineInputSchema.safeParse({
            line_number: lineNum,
            role_name: name,
          })
          expect(result.success).toBe(false)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("always accepts valid lines", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 1, max: 100000 }),
        fc.string({ minLength: 1, maxLength: 40 }),
        (lineNum, name) => {
          const result = ScriptLineInputSchema.safeParse({
            line_number: lineNum,
            role_name: name,
          })
          expect(result.success).toBe(true)
        }
      ),
      { numRuns: 100 }
    )
  })
})

// ─── detectContentType ──────────────────────────────────────────────────────

describe("property: detectContentType", () => {
  it("never crashes on arbitrary text lines", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 100 }), { minLength: 0, maxLength: 100 }),
        (textLines) => {
          const result = detectContentType({ textLines })
          expect(["tabular", "screenplay", "hybrid"]).toContain(result)
        }
      ),
      { numRuns: 200 }
    )
  })
})

// ─── tokenize ────────────────────────────────────────────────────────────────

describe("property: tokenize", () => {
  it("never crashes on arbitrary text", () => {
    fc.assert(
      fc.property(
        fc.string({ minLength: 0, maxLength: 1000 }),
        (text) => {
          const { tokens } = tokenize(text)
          expect(Array.isArray(tokens)).toBe(true)
        }
      ),
      { numRuns: 200 }
    )
  })

  it("produces one token per non-empty line (plus BLANKs)", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 80 }), { minLength: 1, maxLength: 50 }),
        (lines) => {
          const text = lines.join("\n")
          const { tokens } = tokenize(text)
          // Token count should equal the number of lines
          expect(tokens.length).toBe(lines.length)
        }
      ),
      { numRuns: 100 }
    )
  })

  it("preserves correct line numbers", () => {
    fc.assert(
      fc.property(
        fc.array(fc.string({ minLength: 0, maxLength: 80 }), { minLength: 1, maxLength: 30 }),
        (lines) => {
          const text = lines.join("\n")
          const { tokens } = tokenize(text)
          tokens.forEach((t, i) => {
            expect(t.line).toBe(i + 1)
          })
        }
      ),
      { numRuns: 100 }
    )
  })
})
