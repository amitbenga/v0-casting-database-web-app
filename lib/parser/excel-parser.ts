/**
 * Excel Parser Module
 *
 * Parses .xlsx and .xls files to extract role data.
 * Uses SheetJS (xlsx) library for reading Excel files client-side.
 *
 * Flow:
 * 1. Read Excel file → extract headers + rows
 * 2. User maps columns (role_name, replicas_count) via preview dialog
 * 3. Convert mapped data to RoleForDatabase[] format
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
  replicas_count: number
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
      replicas_count: replicasCount,
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
