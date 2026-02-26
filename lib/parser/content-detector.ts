/**
 * Content Type Detector
 *
 * Determines whether a script file contains:
 *   - "tabular"   — structured table data (timecodes, character, dialogue columns)
 *   - "screenplay" — standard screenplay format (ALL-CAPS names + indented dialogue)
 *   - "hybrid"    — both (table in DOCX/PDF alongside free-form text)
 *
 * Detection is heuristic (no LLM) and uses:
 *   - DOCX: presence of <w:tbl> with enough rows
 *   - PDF: column alignment via x-coordinate clustering
 *   - Text: ratio of lines that look tabular vs. screenplay
 */

export type ContentType = "tabular" | "screenplay" | "hybrid"

export interface DetectContentTypeOptions {
  /** Lines of extracted text (for text-based heuristics) */
  textLines?: string[]
  /** Number of aligned PDF columns detected (≥3 suggests tabular) */
  pdfAlignedColumns?: number
  /** Number of rows in the strongest PDF column alignment (≥10 suggests tabular) */
  pdfRowCount?: number
  /** Whether the DOCX file has at least one table element */
  docxHasTables?: boolean
  /** How many data rows the DOCX table(s) contain */
  docxTableRowCount?: number
}

// ─── Main export ──────────────────────────────────────────────────────────────

/**
 * Determine the content type of an extracted script.
 */
export function detectContentType(
  options: DetectContentTypeOptions = {}
): ContentType {
  const {
    textLines = [],
    pdfAlignedColumns = 0,
    pdfRowCount = 0,
    docxHasTables = false,
    docxTableRowCount = 0,
  } = options

  const isTabular =
    (docxHasTables && docxTableRowCount >= 5) ||
    (pdfAlignedColumns >= 3 && pdfRowCount >= 10) ||
    isTextTabular(textLines)

  const isScreenplay = hasScreenplayFeatures(textLines)

  if (isTabular && isScreenplay) return "hybrid"
  if (isTabular) return "tabular"
  return "screenplay"
}

// ─── Heuristics ───────────────────────────────────────────────────────────────

/**
 * Returns true if more than 50 % of non-empty lines look "tabular"
 * (contain tabs, or 3+ consecutive spaces acting as column separators
 * between non-space characters — NOT mere leading indentation).
 */
function isTextTabular(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim().length > 0)
  if (nonEmpty.length < 5) return false

  const tabularCount = nonEmpty.filter((l) => {
    // Tab-separated → tabular
    if (l.includes("\t")) return true
    // 3+ spaces BETWEEN non-space characters (column separator), not just leading indent
    if (/\S[ ]{3,}\S/.test(l)) return true
    // Line starts with a timecode → tabular
    if (/^\d{1,2}:\d{2}:\d{2}/.test(l.trim())) return true
    return false
  }).length

  return tabularCount / nonEmpty.length > 0.5
}

/**
 * Returns true if the text shows typical screenplay formatting:
 *   - centered ALL-CAPS lines (leading spaces + uppercase = character slug)
 *   - ALL-CAPS names above a ratio threshold
 */
export function hasScreenplayFeatures(lines: string[]): boolean {
  const nonEmpty = lines.filter((l) => l.trim().length > 0)
  if (nonEmpty.length === 0) return false

  // Centered uppercase lines (leading spaces + short ALL-CAPS content)
  const centeredCaps = nonEmpty.filter((l) => {
    const t = l.trim()
    return (
      l.startsWith(" ") &&
      t.length > 0 &&
      t.length <= 50 &&
      t === t.toUpperCase() &&
      /^[A-Z]/.test(t)
    )
  })

  // Short standalone ALL-CAPS lines (character names, not centered)
  const standaloneCaps = nonEmpty.filter((l) => {
    const t = l.trim()
    return (
      t.length >= 2 &&
      t.length <= 50 &&
      t === t.toUpperCase() &&
      /^[A-Z]/.test(t) &&
      !/^\d/.test(t)
    )
  })

  const centeredRatio = centeredCaps.length / nonEmpty.length
  const capsRatio = standaloneCaps.length / nonEmpty.length

  return centeredRatio > 0.05 || capsRatio > 0.1
}

// ─── Timecode helpers ─────────────────────────────────────────────────────────

/** Regex for common timecode formats: HH:MM:SS, HH:MM:SS:FF, MM:SS */
export const TIMECODE_PATTERN =
  /\b\d{1,2}:\d{2}:\d{2}(?::\d{2})?\b/

export function looksLikeTimecode(value: string): boolean {
  return TIMECODE_PATTERN.test(value.trim())
}
