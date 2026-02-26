/**
 * Structured Parser — generic tabular data → ScriptLineInput[]
 *
 * Works with any structured/tabular source: Excel sheets, PDF tables, DOCX tables.
 * Replaces the Excel-specific parsing logic in excel-parser.ts with a format-agnostic
 * version that uses a common StructuredParseResult interface.
 *
 * Key exports:
 *   StructuredParseResult   — common row/header format for all tabular sources
 *   StructuredColumnMapping — column-mapping config (same fields as ScriptLineColumnMapping)
 *   autoDetectColumns       — heuristic header→field detection
 *   parseScriptLinesFromStructuredData — rows → ScriptLineInput[]
 *   extractDialogueLines    — plain-text screenplay → ScriptLineInput[]
 */

import type { ScriptLineInput, RecStatus } from "@/lib/types"

// ─── Shared type ─────────────────────────────────────────────────────────────

export interface StructuredParseResult {
  /** Column headers (first row or auto-detected) */
  headers: string[]
  /** Data rows keyed by header */
  rows: Record<string, string | number | null>[]
  /** Origin of the structured data */
  source: "excel" | "pdf-table" | "docx-table" | "text-tabular"
  /** Sheet/table name if applicable */
  sheetName?: string
  /** Total row count (same as rows.length, kept for API symmetry) */
  totalRows: number
}

// ─── Column mapping ───────────────────────────────────────────────────────────

export interface StructuredColumnMapping {
  timecodeColumn?: string
  roleNameColumn: string
  sourceTextColumn?: string
  translationColumn?: string
  recStatusColumn?: string
  notesColumn?: string
  /** When true (default), skip rows where role_name is empty */
  skipEmptyRole?: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const REC_STATUS_VALUES: RecStatus[] = ["הוקלט", "Optional", "לא הוקלט"]

function normalizeRecStatus(value: string | number | null): RecStatus | null {
  if (value == null) return null
  const s = String(value).trim()
  if ((REC_STATUS_VALUES as string[]).includes(s)) return s as RecStatus
  return null
}

// ─── Auto-detect columns ─────────────────────────────────────────────────────

/**
 * Heuristic mapping of column headers to workspace fields.
 * Works with any header list — Excel, PDF, DOCX.
 */
export function autoDetectColumns(
  headers: string[]
): Partial<StructuredColumnMapping> {
  const find = (pattern: RegExp): string | undefined =>
    headers.find((h) => pattern.test(h.trim()))

  return {
    timecodeColumn: find(/^(timecode|tc|time[\s_-]?in|time_in|in[\s_-]?time)$/i),
    roleNameColumn:
      find(/^(character|char|דמות|תפקיד|role[\s_-]?name|role)$/i) ?? "",
    sourceTextColumn: find(
      /^(dialogue|dialog|text|eng(lish)?|source[\s_-]?text|subtitles?)$/i
    ),
    translationColumn: find(
      /^(עברית|heb(rew)?|תרגום|translation|target[\s_-]?text)$/i
    ),
    recStatusColumn: find(/^(rec(ording)?[\s_-]?status|rec|סטטוס|status)$/i),
    notesColumn: find(/^(הערות|notes?|note|remarks?)$/i),
  }
}

// ─── Core conversion ──────────────────────────────────────────────────────────

/**
 * Convert rows from a StructuredParseResult to ScriptLineInput[] using the
 * provided column mapping.
 */
export function parseScriptLinesFromStructuredData(
  result: StructuredParseResult,
  mapping: StructuredColumnMapping
): ScriptLineInput[] {
  const skipEmpty = mapping.skipEmptyRole !== false
  const lines: ScriptLineInput[] = []
  let lineNumber = 1

  for (const row of result.rows) {
    const rawRole = mapping.roleNameColumn ? row[mapping.roleNameColumn] : null
    const roleName = rawRole != null ? String(rawRole).trim() : ""

    if (skipEmpty && !roleName) continue

    const timecode =
      mapping.timecodeColumn && row[mapping.timecodeColumn] != null
        ? String(row[mapping.timecodeColumn]).trim() || undefined
        : undefined

    const sourceText =
      mapping.sourceTextColumn && row[mapping.sourceTextColumn] != null
        ? String(row[mapping.sourceTextColumn]).trim() || undefined
        : undefined

    const translation =
      mapping.translationColumn && row[mapping.translationColumn] != null
        ? String(row[mapping.translationColumn]).trim() || undefined
        : undefined

    const rec_status = mapping.recStatusColumn
      ? normalizeRecStatus(
          row[mapping.recStatusColumn] as string | number | null
        )
      : null

    const notes =
      mapping.notesColumn && row[mapping.notesColumn] != null
        ? String(row[mapping.notesColumn]).trim() || undefined
        : undefined

    lines.push({
      line_number: lineNumber++,
      timecode,
      role_name: roleName,
      source_text: sourceText,
      translation,
      rec_status,
      notes,
    })
  }

  return lines
}

// ─── Plain-text dialogue extraction ──────────────────────────────────────────

/**
 * Extract dialogue lines from plain-text screenplay or dialogue formats:
 *
 *   Format A (colon):
 *     JOHN: Hello, how are you?
 *     MARY: Fine, thanks.
 *
 *   Format B (indented dialogue):
 *     JOHN
 *         Hello, how are you?
 *
 *     MARY
 *         Fine, thanks.
 *
 * Returns ScriptLineInput[] with role_name + source_text populated.
 * Timecode/translation/rec_status are left empty (user fills them later).
 */
export function extractDialogueLines(text: string): ScriptLineInput[] {
  const lines: ScriptLineInput[] = []
  const textLines = text.split(/\r?\n/)
  let lineNumber = 1
  let i = 0

  while (i < textLines.length) {
    const raw = textLines[i]
    const trimmed = raw.trim()

    if (!trimmed) {
      i++
      continue
    }

    // ── Format A: NAME: dialogue text ────────────────────────────────────────
    // ALL-CAPS name followed by colon and text on the same line.
    const colonMatch = trimmed.match(
      /^([A-Z\u05D0-\u05EA][A-Z0-9 \-'.\u05D0-\u05EA]{0,40}):\s+(.+)$/
    )
    if (colonMatch) {
      lines.push({
        line_number: lineNumber++,
        role_name: colonMatch[1].trim(),
        source_text: colonMatch[2].trim(),
      })
      i++
      continue
    }

    // ── Format B: ALL-CAPS NAME followed by indented lines ───────────────────
    const isAllCaps =
      trimmed === trimmed.toUpperCase() &&
      /^[A-Z\u05D0-\u05EA]/.test(trimmed) &&
      trimmed.length >= 2 &&
      trimmed.length <= 50 &&
      !/[.!?]$/.test(trimmed) // doesn't look like end of sentence

    if (isAllCaps) {
      let j = i + 1
      const dialogueParts: string[] = []

      while (j < textLines.length) {
        const nextRaw = textLines[j]
        const nextTrimmed = nextRaw.trim()

        if (!nextTrimmed) {
          j++ // skip blank line within dialogue
          if (dialogueParts.length > 0) break // blank line ends dialogue block
          continue
        }

        // Indented = belongs to previous character's dialogue
        if (nextRaw.startsWith(" ") || nextRaw.startsWith("\t")) {
          dialogueParts.push(nextTrimmed)
          j++
        } else {
          break // non-indented non-empty line → new paragraph or character
        }
      }

      if (dialogueParts.length > 0) {
        lines.push({
          line_number: lineNumber++,
          role_name: trimmed,
          source_text: dialogueParts.join(" "),
        })
        i = j
        continue
      }
    }

    i++
  }

  return lines
}
