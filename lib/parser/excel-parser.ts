/**
 * Excel Parser Module
 *
 * Parses .xlsx and .xls files to extract role data.
 * Uses SheetJS (xlsx) library for reading Excel files client-side.
 *
 * Flow:
 * 1. Read Excel file → extract headers + rows
 * 2. User maps columns (role_name, replicas) via preview dialog
 * 3. Convert mapped data to roles format for database insertion
 */

export interface ExcelSheet {
  name: string
  headers: string[]
  rows: Record<string, string | number | null>[]
  /** First 10 rows for preview */
  preview: Record<string, string | number | null>[]
}

export interface ExcelParseResult {
  sheets: ExcelSheet[]
  fileName: string
  totalRows: number
}

export interface ExcelColumnMapping {
  roleNameColumn: string
  replicasColumn?: string
  sheetIndex: number
}

export interface ExcelMappedRole {
  role_name: string
  role_name_normalized: string
  replicas_needed: number
  source: "script"
}

/**
 * Parse an Excel file and return sheet data with headers and rows
 */
export async function parseExcelFile(file: File): Promise<ExcelParseResult> {
  const XLSX = await import("xlsx")

  const arrayBuffer = await file.arrayBuffer()
  const workbook = XLSX.read(arrayBuffer, { type: "array" })

  const sheets: ExcelSheet[] = []

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName]
    const jsonData = XLSX.utils.sheet_to_json<Record<string, string | number | null>>(worksheet, {
      defval: null,
    })

    if (jsonData.length === 0) continue

    const headers = Object.keys(jsonData[0] || {})

    sheets.push({
      name: sheetName,
      headers,
      rows: jsonData,
      preview: jsonData.slice(0, 10),
    })
  }

  const totalRows = sheets.reduce((sum, s) => sum + s.rows.length, 0)

  return {
    sheets,
    fileName: file.name,
    totalRows,
  }
}

/**
 * Apply column mapping to extract roles from Excel data
 */
export function applyExcelMapping(
  excelResult: ExcelParseResult,
  mapping: ExcelColumnMapping
): ExcelMappedRole[] {
  const sheet = excelResult.sheets[mapping.sheetIndex]
  if (!sheet) return []

  const roles: ExcelMappedRole[] = []
  const seenNames = new Set<string>()

  for (const row of sheet.rows) {
    const rawName = row[mapping.roleNameColumn]
    if (!rawName || String(rawName).trim() === "") continue

    const roleName = String(rawName).trim()
    const normalized = roleName.toUpperCase()

    // Skip duplicates
    if (seenNames.has(normalized)) continue
    seenNames.add(normalized)

    let replicasCount = 1
    if (mapping.replicasColumn && row[mapping.replicasColumn] != null) {
      const parsed = Number(row[mapping.replicasColumn])
      if (!isNaN(parsed) && parsed > 0) {
        replicasCount = Math.round(parsed)
      }
    }

    roles.push({
      role_name: roleName,
      role_name_normalized: normalized,
      replicas_needed: replicasCount,
      source: "script",
    })
  }

  return roles
}

/**
 * Check if a file is an Excel file
 */
export function isExcelFile(file: File): boolean {
  const ext = file.name.split(".").pop()?.toLowerCase()
  return ext === "xlsx" || ext === "xls"
}

// --- Script Lines (Script Workspace) ---

import type { ScriptLineInput, RecStatus } from "@/lib/types"

export interface ScriptLineColumnMapping {
  sheetIndex: number
  timecodeColumn?: string
  roleNameColumn: string
  sourceTextColumn?: string
  translationColumn?: string
  recStatusColumn?: string
  notesColumn?: string
  skipEmptyRole?: boolean
}

const REC_STATUS_VALUES: RecStatus[] = ["הוקלט", "Optional", "לא הוקלט"]

function normalizeRecStatus(value: string | number | null): RecStatus | null {
  if (value == null) return null
  const s = String(value).trim()
  if ((REC_STATUS_VALUES as string[]).includes(s)) return s as RecStatus
  return null
}

/**
 * Auto-detect column mapping from sheet headers.
 */
export function autoDetectScriptLineColumns(
  headers: string[]
): Partial<ScriptLineColumnMapping> {
  const find = (patterns: RegExp): string | undefined =>
    headers.find((h) => patterns.test(h))

  return {
    timecodeColumn: find(/^(timecode|tc|time\s*in|time_in)$/i),
    roleNameColumn:
      find(/^(character|char|דמות|תפקיד|role)$/i) ?? "",
    sourceTextColumn: find(/^(dialogue|text|eng|english|subtitles)$/i),
    translationColumn: find(/^(עברית|heb|hebrew|תרגום|translation)$/i),
    recStatusColumn: find(/^(rec|סטטוס|status|recording)$/i),
    notesColumn: find(/^(הערות|notes|note)$/i),
  }
}

/**
 * Extract ScriptLineInput[] from an ExcelParseResult using a column mapping.
 */
export function parseScriptLinesFromExcel(
  excelResult: ExcelParseResult,
  mapping: ScriptLineColumnMapping
): ScriptLineInput[] {
  const sheet = excelResult.sheets[mapping.sheetIndex]
  if (!sheet) return []

  const skipEmpty = mapping.skipEmptyRole !== false
  const lines: ScriptLineInput[] = []
  let lineNumber = 1

  for (const row of sheet.rows) {
    const rawRole = mapping.roleNameColumn ? row[mapping.roleNameColumn] : null
    const roleName = rawRole != null ? String(rawRole).trim() : ""

    if (skipEmpty && !roleName) continue

    const timecode = mapping.timecodeColumn && row[mapping.timecodeColumn] != null
      ? String(row[mapping.timecodeColumn]).trim()
      : undefined

    const sourceText =
      mapping.sourceTextColumn && row[mapping.sourceTextColumn] != null
        ? String(row[mapping.sourceTextColumn]).trim()
        : undefined

    const translation =
      mapping.translationColumn && row[mapping.translationColumn] != null
        ? String(row[mapping.translationColumn]).trim()
        : undefined

    const rec_status = mapping.recStatusColumn
      ? normalizeRecStatus(row[mapping.recStatusColumn] as string | number | null)
      : null

    const notes =
      mapping.notesColumn && row[mapping.notesColumn] != null
        ? String(row[mapping.notesColumn]).trim()
        : undefined

    lines.push({
      line_number: lineNumber++,
      timecode,
      role_name: roleName,
      source_text: sourceText,
      translation: translation || undefined,
      rec_status,
      notes: notes || undefined,
    })
  }

  return lines
}
