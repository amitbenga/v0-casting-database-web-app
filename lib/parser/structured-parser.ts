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
import { validateScriptLines, validateColumnMapping } from "./schemas"
import type { ParseDiagnostic } from "./diagnostics"
import { isCharacterStopword } from "./tokenizer"

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
  /**
   * COMP change list column (e.g. "COMP CHANGE DETAILS").
   * When set, each cell is parsed with parseCompChangeCell() to extract
   * role_name + source_text + notes from embedded text like:
   *   'Sneezy "Give it to me" removed'
   *   'Grumpy "text" // Sneezy "text2"'
   *   'Dopey breath added'
   */
  compChangeColumn?: string
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
 *
 * Uses partial (contains) matching instead of exact `^...$` anchors so that
 * common column names like "שם תפקיד", "Character Name", "TC In", etc. are
 * correctly detected even when they contain extra words.
 */
export function autoDetectColumns(
  headers: string[]
): Partial<StructuredColumnMapping> {
  // Case-insensitive contains-style search (pattern can match anywhere in header)
  const find = (pattern: RegExp): string | undefined =>
    headers.find((h) => pattern.test(h.trim()))

  return {
    // Timecode: prefer "TC In" / "Timecode In" over generic "Timecode Out"
    timecodeColumn:
      find(/time[\s_-]?in\b|tc[\s_-]?in\b|in[\s_-]?time\b/i) ??   // "TIMECODE IN", "TC In", "Time_in"
      find(/\btimecode\b|\btc\b/i),                                  // generic "Timecode", "TC"

    // Role name — highest priority keywords first; avoid matching actor/speaker cols
    roleNameColumn:
      find(/תפקיד|דמות/i) ??                // Hebrew: role / character
      find(/character|role[\s_-]?name/i) ??  // English: "character", "role name"
      find(/\brole\b/i) ??                    // English: bare "role"
      find(/\bchar\b/i) ??                    // Short abbreviation
      "",

    // Source text (original dialogue) — extended with dubbing-industry variants:
    //   "Original Version" (Word translation tables)
    //   "Content" / "CONTENT :: DIALOGUE TRANSCRIPTION" (Deluxe Excel)
    //   "Transcription" / "Dialogue Transcription"
    sourceTextColumn: find(
      /dialogue|dialog|source[\s_-]?text|subtitles?|\beng(?:lish)?\b|original[\s_-]?version|\boriginal\b|\bcontent\b|transcription/i
    ),

    // Hebrew translation
    translationColumn: find(
      /עברית|תרגום|translation|target[\s_-]?text|\bheb(?:rew)?\b/i
    ),

    // Recording status — "Rec Status", "Recording Status", "Status", "Rec", "סטטוס"
    recStatusColumn: find(/rec(?:ording)?[\s_-]?status|\bstatus\b|\bסטטוס\b|\brec\b/i),

    // Notes / remarks — extended with "Comments" and "Annotations" (Deluxe Excel)
    notesColumn: find(/הערות|\bnotes?\b|\bremarks?\b|\bcomments?\b|annotations?/i),

    // COMP change list column: "COMP CHANGE DETAILS", "Change Details", "Change List"
    compChangeColumn: find(/comp[\s_-]?change|change[\s_-]?details?|change[\s_-]?list/i),
  }
}

// ─── Confidence-scored auto-detect ────────────────────────────────────────────

export interface ColumnDetectionResult {
  /** The detected mapping (same as autoDetectColumns output) */
  mapping: Partial<StructuredColumnMapping>
  /** Confidence score 0–100 */
  confidence: number
  /** How many fields were matched */
  matchedCount: number
  /** Which fields were detected */
  detectedFields: string[]
}

/**
 * Same as autoDetectColumns but also returns a confidence score (0–100).
 *
 * Scoring weights:
 *   roleName     = 40  (required — without it the import is useless)
 *   sourceText   = 20  (dialogue column)
 *   timecode     = 15
 *   translation  = 10
 *   recStatus    = 10
 *   notes        = 5
 *
 * Example: roleNameColumn + sourceTextColumn + timecodeColumn → 40+20+15 = 75
 */
export function autoDetectColumnsWithConfidence(
  headers: string[]
): ColumnDetectionResult {
  if (headers.length === 0) {
    return { mapping: { roleNameColumn: "" }, confidence: 0, matchedCount: 0, detectedFields: [] }
  }

  const mapping = autoDetectColumns(headers)
  const detectedFields: string[] = []
  let score = 0

  if (mapping.roleNameColumn)   { score += 40; detectedFields.push("roleName") }
  if (mapping.sourceTextColumn) { score += 20; detectedFields.push("sourceText") }
  if (mapping.timecodeColumn)   { score += 15; detectedFields.push("timecode") }
  if (mapping.translationColumn){ score += 10; detectedFields.push("translation") }
  if (mapping.recStatusColumn)  { score += 10; detectedFields.push("recStatus") }
  if (mapping.notesColumn)      { score += 5;  detectedFields.push("notes") }

  return {
    mapping,
    confidence: score,
    matchedCount: detectedFields.length,
    detectedFields,
  }
}

// ─── In-cell character extraction ────────────────────────────────────────────

/**
 * Pattern for "CHARACTER: dialogue text" within a single table cell.
 * Handles formats like:
 *   "Gru: Hello everybody."
 *   "LUCY/WYLDSTYLE: Come back!"
 *   "Snow White: Who are you?"
 *
 * Character name: Title-case or ALL-CAPS, may include spaces and /.
 * Must start with uppercase letter.
 */
const IN_CELL_CHAR_RE =
  /^([A-Z][A-Za-z0-9 '\/\.\-]{0,40}):\s+(.+)$/

/**
 * Try to split a source cell that contains "CHARACTER: dialogue text".
 * Returns null if the pattern is not found.
 *
 * Used for Word/DOCX translation tables where the "Original Version" column
 * stores lines like "Gru: Hello everybody." instead of a separate role column.
 */
export function splitInCellCharacter(
  text: string
): { role_name: string; source_text: string } | null {
  const match = text.trim().match(IN_CELL_CHAR_RE)
  if (!match) return null
  return { role_name: match[1].trim(), source_text: match[2].trim() }
}

// ─── COMP change list parser ──────────────────────────────────────────────────

/**
 * Parse a COMP (composite) change list cell into one or more ScriptLineInput rows.
 *
 * COMP change lists are produced by vendors (Deluxe, etc.) and show dialogue
 * changes between script versions. Each cell in the "COMP CHANGE DETAILS"
 * column embeds the character name, optional dialogue, and an action:
 *
 *   'Sneezy "Give it to me" removed'         → role + source + notes
 *   'Dopey breath added'                      → role + notes (no dialogue)
 *   'Doc "Two hundred..." +2fr'               → role + source + notes
 *   'Happy "<chuckles>" removed'              → role + source (sound effect) + notes
 *   'Sleepy/Grumpy "<groan>" removed'         → combined role + source + notes
 *   'Grumpy "text1" added // Sneezy "text2"'  → two rows (split on //)
 *
 * @param timecode  The TC IN value for this row (may be undefined)
 * @param cellValue The COMP CHANGE DETAILS cell content
 * @param extraNotes Optional extra notes from a COMMENTS column
 * @returns One or more ScriptLineInput entries (line_number set to 0; caller renumbers)
 */
export function parseCompChangeCell(
  timecode: string | undefined,
  cellValue: string,
  extraNotes?: string
): ScriptLineInput[] {
  const results: ScriptLineInput[] = []

  // Split on // for multi-character entries on one row
  const parts = cellValue.split(/\s*\/\/\s*/)

  for (const part of parts) {
    const trimmed = part.trim()
    if (!trimmed) continue

    // Pattern A: CHARACTER "quoted text" [action]
    // Handles both straight quotes and curly/smart quotes, plus <angle brackets>
    const quotedMatch =
      trimmed.match(/^(.+?)\s+"([^"]+)"\s*(.*)$/) ??    // straight double quotes
      trimmed.match(/^(.+?)\s+\u201C([^\u201D]+)\u201D\s*(.*)$/) ?? // "curly" quotes
      trimmed.match(/^(.+?)\s+'([^']+)'\s*(.*)$/) ??    // single quotes
      trimmed.match(/^(.+?)\s+<([^>]+)>\s*(.*)$/)       // <angle brackets>

    if (quotedMatch) {
      const roleName = quotedMatch[1].trim()
      const sourceText = quotedMatch[2].trim()
      const action = quotedMatch[3].trim()
      const notes = [action, extraNotes].filter(Boolean).join("; ") || undefined
      results.push({
        line_number: 0,
        timecode,
        role_name: roleName,
        source_text: sourceText,
        notes,
      })
      continue
    }

    // Pattern B: CHARACTER [sound/action] added/removed/+Xfr/-Xfr
    // Split on the FIRST known sound-effect or action word so that multi-word
    // character names (e.g. "Snow White") are captured correctly:
    //   "Dopey breath added"       → role="Dopey"      notes="breath added"
    //   "Snow White inhale added"  → role="Snow White" notes="inhale added"
    //   "Happy effort changed"     → role="Happy"      notes="effort changed"
    const actionMatch = trimmed.match(
      /^(.+?)\s+((?:breaths?|breathing|inhales?|exhales?|gasps?|grunts?|groans?|sighs?|laughs?|chuckles?|coughs?|screams?|whispers?|yells?|shouts?|sobs?|cries?|crying|moans?|efforts?|effortful|added|removed|changed|[+-]\d+fr).*)$/i
    )
    if (actionMatch) {
      const roleName = actionMatch[1].trim()
      const notes = [actionMatch[2].trim(), extraNotes]
        .filter(Boolean)
        .join("; ") || undefined
      results.push({
        line_number: 0,
        timecode,
        role_name: roleName,
        notes,
      })
      continue
    }

    // Pattern C: fallback — first capitalized word(s) = role, rest = notes
    // e.g. "Grumpy effortful yell" (no action keyword)
    const firstCapMatch = trimmed.match(
      /^([A-Z][a-zA-Z]*(?:[\s\/][A-Z][a-zA-Z]*)*)\s+(.+)$/
    )
    if (firstCapMatch) {
      const notes = [firstCapMatch[2].trim(), extraNotes]
        .filter(Boolean)
        .join("; ") || undefined
      results.push({
        line_number: 0,
        timecode,
        role_name: firstCapMatch[1].trim(),
        notes,
      })
      continue
    }

    // Last resort: whole cell = role_name
    results.push({
      line_number: 0,
      timecode,
      role_name: trimmed,
      notes: extraNotes || undefined,
    })
  }

  return results
}

// ─── Core conversion ──────────────────────────────────────────────────────────

/**
 * Convert rows from a StructuredParseResult to ScriptLineInput[] using the
 * provided column mapping.
 *
 * Supports three special modes beyond basic column mapping:
 *
 * 1. **COMP change list** (`compChangeColumn` set): each cell is parsed with
 *    parseCompChangeCell() to extract role_name + source_text + notes from
 *    embedded text like 'Sneezy "Give it to me" removed'.
 *
 * 2. **In-cell character extraction** (no `roleNameColumn`): when source cells
 *    contain "CHARACTER: dialogue text" (e.g. Word translation tables), the
 *    character name is automatically extracted from the source cell.
 *
 * 3. **Standard** (role column present): straightforward column→field mapping.
 */
export function parseScriptLinesFromStructuredData(
  result: StructuredParseResult,
  mapping: StructuredColumnMapping
): ScriptLineInput[] {
  const skipEmpty = mapping.skipEmptyRole !== false
  const hasRoleColumn = Boolean(mapping.roleNameColumn)
  const hasCompColumn = Boolean(mapping.compChangeColumn)
  const lines: ScriptLineInput[] = []
  let lineNumber = 1

  for (const row of result.rows) {
    // ── Mode 1: COMP change list ──────────────────────────────────────────────
    if (hasCompColumn) {
      const compValue =
        mapping.compChangeColumn && row[mapping.compChangeColumn] != null
          ? String(row[mapping.compChangeColumn]).trim()
          : ""
      if (!compValue) continue

      const timecode =
        mapping.timecodeColumn && row[mapping.timecodeColumn] != null
          ? String(row[mapping.timecodeColumn]).trim() || undefined
          : undefined

      const extraNotes =
        mapping.notesColumn && row[mapping.notesColumn] != null
          ? String(row[mapping.notesColumn]).trim() || undefined
          : undefined

      const parsed = parseCompChangeCell(timecode, compValue, extraNotes)
      for (const p of parsed) {
        lines.push({ ...p, line_number: lineNumber++ })
      }
      continue
    }

    // ── Mode 2 & 3: standard + optional in-cell extraction ───────────────────
    const rawRole = hasRoleColumn ? row[mapping.roleNameColumn] : null
    let roleName = rawRole != null ? String(rawRole).trim() : ""

    const timecode =
      mapping.timecodeColumn && row[mapping.timecodeColumn] != null
        ? String(row[mapping.timecodeColumn]).trim() || undefined
        : undefined

    let sourceText =
      mapping.sourceTextColumn && row[mapping.sourceTextColumn] != null
        ? String(row[mapping.sourceTextColumn]).trim() || undefined
        : undefined

    // Mode 2: no explicit role column → try to extract "CHARACTER: text" from source cell
    if (!hasRoleColumn && sourceText) {
      const split = splitInCellCharacter(sourceText)
      if (split) {
        roleName = split.role_name
        sourceText = split.source_text
      }
    }

    if (skipEmpty && !roleName) continue

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
    if (colonMatch && !isCharacterStopword(colonMatch[1].trim())) {
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
      !/[.!?]$/.test(trimmed) && // doesn't look like end of sentence
      !isCharacterStopword(trimmed)

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

// ─── Validated versions ──────────────────────────────────────────────────────

export interface ValidatedParseOutput {
  lines: ScriptLineInput[]
  diagnostics: ParseDiagnostic[]
}

/**
 * Same as `parseScriptLinesFromStructuredData` but with zod validation.
 * Invalid lines are reported in diagnostics instead of silently passed through.
 */
export function parseAndValidateStructuredData(
  result: StructuredParseResult,
  mapping: StructuredColumnMapping
): ValidatedParseOutput {
  // Validate the mapping against available headers
  const mappingDiags = validateColumnMapping(mapping, result.headers)
  if (mappingDiags.some((d) => d.severity === "error")) {
    return { lines: [], diagnostics: mappingDiags }
  }

  const rawLines = parseScriptLinesFromStructuredData(result, mapping)
  const validated = validateScriptLines(rawLines)

  return {
    lines: validated.data,
    diagnostics: [...mappingDiags, ...validated.diagnostics],
  }
}
