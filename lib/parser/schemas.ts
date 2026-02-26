/**
 * Zod Validation Schemas for Parser Types
 *
 * Runtime validation for all data flowing through the parser pipeline.
 * Catches malformed data before it reaches the database.
 *
 * Usage:
 *   import { ScriptLineInputSchema, validateScriptLines } from "./schemas"
 *   const result = validateScriptLines(rawLines)
 *   if (!result.success) console.warn(result.diagnostics)
 */

import { z } from "zod"
import type { ParseDiagnostic } from "./diagnostics"

// ─── Timecode ────────────────────────────────────────────────────────────────

/** HH:MM:SS, HH:MM:SS:FF, or MM:SS */
export const TimecodeSchema = z
  .string()
  .regex(
    /^\d{1,2}:\d{2}:\d{2}(?::\d{2})?$/,
    "פורמט timecode לא תקין — צפוי HH:MM:SS או HH:MM:SS:FF"
  )

// ─── RecStatus ───────────────────────────────────────────────────────────────

export const RecStatusSchema = z.enum(["הוקלט", "Optional", "לא הוקלט"])

// ─── ScriptLineInput ─────────────────────────────────────────────────────────

export const ScriptLineInputSchema = z.object({
  line_number: z.number().int().positive("מספר שורה חייב להיות חיובי"),
  timecode: TimecodeSchema.optional(),
  role_name: z.string().min(1, "שם תפקיד חייב להכיל לפחות תו אחד"),
  actor_id: z.string().nullable().optional(),
  source_text: z.string().optional(),
  translation: z.string().optional(),
  rec_status: RecStatusSchema.nullable().optional(),
  notes: z.string().optional(),
})

export type ValidatedScriptLineInput = z.infer<typeof ScriptLineInputSchema>

// ─── StructuredParseResult ───────────────────────────────────────────────────

export const StructuredParseResultSchema = z.object({
  headers: z.array(z.string()).min(1, "חייב להכיל לפחות עמודה אחת"),
  rows: z.array(z.record(z.string(), z.union([z.string(), z.number(), z.null()]))),
  source: z.enum(["excel", "pdf-table", "docx-table", "text-tabular"]),
  sheetName: z.string().optional(),
  totalRows: z.number().int().nonnegative(),
})

// ─── StructuredColumnMapping ─────────────────────────────────────────────────

export const StructuredColumnMappingSchema = z.object({
  timecodeColumn: z.string().optional(),
  roleNameColumn: z.string().min(1, "חובה לבחור עמודת תפקיד"),
  sourceTextColumn: z.string().optional(),
  translationColumn: z.string().optional(),
  recStatusColumn: z.string().optional(),
  notesColumn: z.string().optional(),
  skipEmptyRole: z.boolean().optional(),
})

// ─── Batch validation ────────────────────────────────────────────────────────

export interface ValidationResult<T> {
  success: boolean
  /** Validated data — only lines that passed validation */
  data: T[]
  /** Lines that failed validation, with diagnostics */
  rejected: { index: number; raw: unknown; errors: string[] }[]
  /** Summary diagnostics for the UI */
  diagnostics: ParseDiagnostic[]
}

/**
 * Validate an array of ScriptLineInput with detailed error reporting.
 * Lines that fail validation are collected in `rejected`, not thrown.
 * This implements "best-effort" / "partial parsing" — valid lines proceed.
 */
export function validateScriptLines(
  lines: unknown[]
): ValidationResult<ValidatedScriptLineInput> {
  const data: ValidatedScriptLineInput[] = []
  const rejected: ValidationResult<ValidatedScriptLineInput>["rejected"] = []
  const diagnostics: ParseDiagnostic[] = []

  for (let i = 0; i < lines.length; i++) {
    const result = ScriptLineInputSchema.safeParse(lines[i])

    if (result.success) {
      data.push(result.data)
    } else {
      const errors = result.error.issues.map(
        (iss) => `${iss.path.join(".")}: ${iss.message}`
      )
      rejected.push({ index: i, raw: lines[i], errors })
      diagnostics.push({
        severity: "warning",
        message: `שורה ${i + 1}: ${errors.join("; ")}`,
        line: i + 1,
        source: "validation",
      })
    }
  }

  if (rejected.length > 0) {
    diagnostics.unshift({
      severity: rejected.length === lines.length ? "error" : "warning",
      message: `${rejected.length} מתוך ${lines.length} שורות לא עברו אימות`,
      source: "validation",
    })
  }

  return {
    success: rejected.length === 0,
    data,
    rejected,
    diagnostics,
  }
}

/**
 * Validate a StructuredParseResult.
 * Returns diagnostics if the structure is malformed.
 */
export function validateStructuredResult(
  result: unknown
): { success: boolean; data?: z.infer<typeof StructuredParseResultSchema>; diagnostics: ParseDiagnostic[] } {
  const parsed = StructuredParseResultSchema.safeParse(result)

  if (parsed.success) {
    // Additional semantic checks
    const diag: ParseDiagnostic[] = []
    const { headers, rows, totalRows } = parsed.data

    if (rows.length !== totalRows) {
      diag.push({
        severity: "warning",
        message: `totalRows (${totalRows}) לא תואם למספר השורות בפועל (${rows.length})`,
        source: "validation",
      })
    }

    // Check for duplicate headers
    const headerSet = new Set<string>()
    for (const h of headers) {
      if (headerSet.has(h)) {
        diag.push({
          severity: "warning",
          message: `כותרת כפולה: "${h}"`,
          source: "validation",
        })
      }
      headerSet.add(h)
    }

    return { success: true, data: parsed.data, diagnostics: diag }
  }

  return {
    success: false,
    diagnostics: parsed.error.issues.map((iss) => ({
      severity: "error" as const,
      message: `${iss.path.join(".")}: ${iss.message}`,
      source: "validation" as const,
    })),
  }
}

/**
 * Validate a column mapping against available headers.
 * Returns diagnostics for columns that reference non-existent headers.
 */
export function validateColumnMapping(
  mapping: unknown,
  availableHeaders: string[]
): ParseDiagnostic[] {
  const parsed = StructuredColumnMappingSchema.safeParse(mapping)
  if (!parsed.success) {
    return parsed.error.issues.map((iss) => ({
      severity: "error" as const,
      message: `מיפוי שגוי: ${iss.path.join(".")} — ${iss.message}`,
      source: "validation" as const,
    }))
  }

  const diag: ParseDiagnostic[] = []
  const headerSet = new Set(availableHeaders)
  const m = parsed.data

  const columnsToCheck: { name: string; value?: string }[] = [
    { name: "תפקיד", value: m.roleNameColumn },
    { name: "timecode", value: m.timecodeColumn },
    { name: "טקסט מקור", value: m.sourceTextColumn },
    { name: "תרגום", value: m.translationColumn },
    { name: "סטטוס הקלטה", value: m.recStatusColumn },
    { name: "הערות", value: m.notesColumn },
  ]

  for (const col of columnsToCheck) {
    if (col.value && !headerSet.has(col.value)) {
      diag.push({
        severity: "error",
        message: `עמודת ${col.name} "${col.value}" לא נמצאה בכותרות. עמודות זמינות: ${availableHeaders.join(", ")}`,
        source: "validation",
      })
    }
  }

  return diag
}
