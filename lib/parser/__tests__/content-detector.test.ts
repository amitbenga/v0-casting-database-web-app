import { describe, it, expect } from "vitest"
import { detectContentType, hasScreenplayFeatures, looksLikeTimecode } from "../content-detector"

// ─── detectContentType ────────────────────────────────────────────────────────

describe("detectContentType", () => {
  it('returns "screenplay" for empty options', () => {
    expect(detectContentType()).toBe("screenplay")
  })

  it('returns "tabular" when DOCX has enough table rows', () => {
    expect(detectContentType({ docxHasTables: true, docxTableRowCount: 20 })).toBe("tabular")
  })

  it('returns "screenplay" when DOCX table rows below threshold', () => {
    expect(detectContentType({ docxHasTables: true, docxTableRowCount: 3 })).toBe("screenplay")
  })

  it('returns "tabular" when PDF has enough aligned columns and rows', () => {
    expect(detectContentType({ pdfAlignedColumns: 4, pdfRowCount: 50 })).toBe("tabular")
  })

  it('returns "screenplay" when PDF column count too low', () => {
    expect(detectContentType({ pdfAlignedColumns: 2, pdfRowCount: 50 })).toBe("screenplay")
  })

  it('returns "screenplay" when PDF row count too low', () => {
    expect(detectContentType({ pdfAlignedColumns: 4, pdfRowCount: 5 })).toBe("screenplay")
  })

  it('returns "tabular" for tab-delimited text lines', () => {
    const textLines = Array.from({ length: 20 }, (_, i) =>
      `00:0${i}:00\tJOHN\tHello line ${i}`
    )
    expect(detectContentType({ textLines })).toBe("tabular")
  })

  it('returns "screenplay" for all-caps centered lines', () => {
    const textLines = [
      "",
      "            JOHN",
      "    Hello, how are you today?",
      "",
      "            MARY",
      "    Fine, thanks.",
      "",
      "            JOHN",
      "    Great to hear it.",
    ]
    expect(detectContentType({ textLines })).toBe("screenplay")
  })

  it('returns "hybrid" when DOCX has tables AND screenplay features', () => {
    // Has enough DOCX table rows + screenplay features in text
    const screenplayLines = Array.from({ length: 30 }, (_, i) =>
      i % 3 === 0 ? "            JOHN" : i % 3 === 1 ? "    Some dialogue here." : ""
    )
    expect(
      detectContentType({
        docxHasTables: true,
        docxTableRowCount: 30,
        textLines: screenplayLines,
      })
    ).toBe("hybrid")
  })

  it('returns "hybrid" when PDF has tables AND screenplay features', () => {
    const screenplayLines = Array.from({ length: 30 }, (_, i) =>
      i % 3 === 0 ? "            JOHN" : i % 3 === 1 ? "    Some dialogue here." : ""
    )
    expect(
      detectContentType({
        pdfAlignedColumns: 4,
        pdfRowCount: 50,
        textLines: screenplayLines,
      })
    ).toBe("hybrid")
  })
})

// ─── hasScreenplayFeatures ────────────────────────────────────────────────────

describe("hasScreenplayFeatures", () => {
  it("detects centered ALL-CAPS character names", () => {
    const lines = [
      "            JOHN",
      "    Some dialogue line here.",
      "",
      "            MARY",
      "    More dialogue.",
    ]
    expect(hasScreenplayFeatures(lines)).toBe(true)
  })

  it("detects standalone ALL-CAPS names above ratio threshold", () => {
    const lines = Array.from({ length: 20 }, (_, i) =>
      i % 2 === 0 ? "JOHN" : "Some dialogue text here for the character."
    )
    expect(hasScreenplayFeatures(lines)).toBe(true)
  })

  it("returns false for plain prose text", () => {
    const lines = [
      "This is a regular paragraph.",
      "It has no character names.",
      "Just normal text here.",
      "Another line of prose.",
      "And another one.",
      "More prose continues.",
      "The story goes on.",
      "Finally the last line.",
    ]
    expect(hasScreenplayFeatures(lines)).toBe(false)
  })

  it("returns false for empty array", () => {
    expect(hasScreenplayFeatures([])).toBe(false)
  })

  it("returns false for only-empty lines", () => {
    expect(hasScreenplayFeatures(["", " ", "  "])).toBe(false)
  })
})

// ─── looksLikeTimecode ────────────────────────────────────────────────────────

describe("looksLikeTimecode", () => {
  it("matches HH:MM:SS format", () => {
    expect(looksLikeTimecode("00:01:23")).toBe(true)
    expect(looksLikeTimecode("01:23:45")).toBe(true)
  })

  it("matches HH:MM:SS:FF format", () => {
    expect(looksLikeTimecode("00:01:23:10")).toBe(true)
    expect(looksLikeTimecode("01:23:45:00")).toBe(true)
  })

  it("rejects non-timecode strings", () => {
    expect(looksLikeTimecode("hello")).toBe(false)
    expect(looksLikeTimecode("1234")).toBe(false)
    expect(looksLikeTimecode("")).toBe(false)
  })

  it("detects timecodes within longer strings", () => {
    expect(looksLikeTimecode("TC: 00:01:23")).toBe(true)
  })
})
