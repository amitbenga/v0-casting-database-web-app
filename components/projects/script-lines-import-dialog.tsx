"use client"

import { useState, useMemo, useEffect } from "react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { AlertCircle, FileSpreadsheet, CheckCircle } from "lucide-react"
import type { ExcelParseResult } from "@/lib/parser/excel-parser"
import {
  autoDetectScriptLineColumns,
  parseScriptLinesFromExcel,
  type ScriptLineColumnMapping,
} from "@/lib/parser/excel-parser"
import {
  autoDetectColumns,
  parseScriptLinesFromStructuredData,
  type StructuredParseResult,
} from "@/lib/parser/structured-parser"
import type { ScriptLineInput } from "@/lib/types"

/**
 * The dialog accepts either:
 *   - excelResult  (single Excel file — backward compat)
 *   - excelResults (multiple Excel files — per-file tabs)
 *   - structuredData (PDF/DOCX table flow)
 * Exactly one mode must be provided.
 */
interface ScriptLinesImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Single Excel file (backward compat) */
  excelResult?: ExcelParseResult
  /** Multiple Excel files — shown as tabs, each with independent mapping */
  excelResults?: ExcelParseResult[]
  /** Pre-extracted tabular data from PDF/DOCX */
  structuredData?: StructuredParseResult[]
  sourceLabel?: string
  onImport: (lines: ScriptLineInput[]) => void
  isImporting?: boolean
}

const NONE = "__none__"

// ─── Per-file column mapping state ───────────────────────────────────────────

interface FileMapping {
  selectedSheet: number
  roleCol: string
  timecodeCol: string
  sourceCol: string
  notesCol: string
}

// ─── Normalised sheet (shared between Excel and structured modes) ─────────────

interface NormalisedSheet {
  name: string
  headers: string[]
  rows: Record<string, string | number | null>[]
  totalRows: number
}

function normaliseSheetsFromStructured(structuredData: StructuredParseResult[]): NormalisedSheet[] {
  return structuredData.map((sd, i) => ({
    name: sd.sheetName ?? `Table ${i + 1}`,
    headers: sd.headers,
    rows: sd.rows,
    totalRows: sd.totalRows,
  }))
}

function autoDetectForHeaders(headers: string[], isExcel: boolean): Omit<FileMapping, "selectedSheet"> {
  const detected = isExcel ? autoDetectScriptLineColumns(headers) : autoDetectColumns(headers)
  return {
    roleCol: detected.roleNameColumn ?? "",
    timecodeCol: detected.timecodeColumn ?? NONE,
    sourceCol: detected.sourceTextColumn ?? NONE,
    notesCol: detected.notesColumn ?? NONE,
  }
}

// ─────────────────────────────────────────────────────────────────────────────

export function ScriptLinesImportDialog({
  open,
  onOpenChange,
  excelResult,
  excelResults,
  structuredData,
  sourceLabel,
  onImport,
  isImporting = false,
}: ScriptLinesImportDialogProps) {
  // Normalise all Excel files into a single array
  const allFiles = useMemo(
    () => excelResults ?? (excelResult ? [excelResult] : []),
    [excelResults, excelResult]
  )
  const isExcelMode = allFiles.length > 0
  const isMultiFile = allFiles.length > 1

  // ── Excel mode: per-file state ────────────────────────────────────────────
  const [activeFile, setActiveFile] = useState(0)
  const [fileMappings, setFileMappings] = useState<FileMapping[]>([])

  useEffect(() => {
    if (!open || !isExcelMode) return
    setActiveFile(0)
    setFileMappings(
      allFiles.map((f) => ({
        selectedSheet: 0,
        ...autoDetectForHeaders(f.sheets[0]?.headers ?? [], true),
      }))
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, excelResults, excelResult])

  function handleSheetChange(fileIdx: number, sheetIdx: number) {
    const headers = allFiles[fileIdx]?.sheets[sheetIdx]?.headers ?? []
    setFileMappings((prev) => {
      const next = [...prev]
      next[fileIdx] = { selectedSheet: sheetIdx, ...autoDetectForHeaders(headers, true) }
      return next
    })
  }

  function updateFileField(fileIdx: number, field: keyof Omit<FileMapping, "selectedSheet">, value: string) {
    setFileMappings((prev) => {
      const next = [...prev]
      next[fileIdx] = { ...next[fileIdx], [field]: value }
      return next
    })
  }

  // ── Structured mode (PDF/DOCX): single-state ──────────────────────────────
  const structuredSheets = useMemo(
    () => (structuredData ? normaliseSheetsFromStructured(structuredData) : []),
    [structuredData]
  )
  const [structuredSheet, setStructuredSheet] = useState(0)
  const [sRoleCol, setSRoleCol] = useState("")
  const [sTimecodeCol, setSTimecodeCol] = useState(NONE)
  const [sSourceCol, setSSourceCol] = useState(NONE)
  const [sNotesCol, setSNotesCol] = useState(NONE)

  useEffect(() => {
    if (!open || isExcelMode || structuredSheets.length === 0) return
    setStructuredSheet(0)
    applyStructuredAutoDetect(0)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, structuredData])

  function applyStructuredAutoDetect(idx: number) {
    const headers = structuredSheets[idx]?.headers ?? []
    const d = autoDetectColumns(headers)
    setSRoleCol(d.roleNameColumn ?? "")
    setSTimecodeCol(d.timecodeColumn ?? NONE)
    setSSourceCol(d.sourceTextColumn ?? NONE)
    setSNotesCol(d.notesColumn ?? NONE)
  }

  function handleStructuredSheetChange(idx: number) {
    setStructuredSheet(idx)
    applyStructuredAutoDetect(idx)
  }

  // ── Derived values for the currently visible config ───────────────────────
  const activeMapping = fileMappings[activeFile]
  const activeFileData = allFiles[activeFile]
  const activeSheetHeaders =
    activeFileData?.sheets[activeMapping?.selectedSheet ?? 0]?.headers ?? []

  // Unified getters/setters — drive the mapping grid regardless of mode
  const roleCol = isExcelMode ? (activeMapping?.roleCol ?? "") : sRoleCol
  const timecodeCol = isExcelMode ? (activeMapping?.timecodeCol ?? NONE) : sTimecodeCol
  const sourceCol = isExcelMode ? (activeMapping?.sourceCol ?? NONE) : sSourceCol
  const notesCol = isExcelMode ? (activeMapping?.notesCol ?? NONE) : sNotesCol
  const displayHeaders = isExcelMode ? activeSheetHeaders : (structuredSheets[structuredSheet]?.headers ?? [])

  function setRoleCol(v: string) { isExcelMode ? updateFileField(activeFile, "roleCol", v) : setSRoleCol(v) }
  function setTimecodeCol(v: string) { isExcelMode ? updateFileField(activeFile, "timecodeCol", v) : setSTimecodeCol(v) }
  function setSourceCol(v: string) { isExcelMode ? updateFileField(activeFile, "sourceCol", v) : setSSourceCol(v) }
  function setNotesCol(v: string) { isExcelMode ? updateFileField(activeFile, "notesCol", v) : setSNotesCol(v) }

  // Sheets shown in the sheet-selector for the active context
  const currentSheets = isExcelMode
    ? (activeFileData?.sheets.map((s, i) => ({ name: s.name, totalRows: s.rows.length, index: i })) ?? [])
    : structuredSheets.map((s, i) => ({ name: s.name, totalRows: s.totalRows, index: i }))
  const currentSelectedSheet = isExcelMode ? (activeMapping?.selectedSheet ?? 0) : structuredSheet

  function handleCurrentSheetChange(idx: number) {
    if (isExcelMode) handleSheetChange(activeFile, idx)
    else handleStructuredSheetChange(idx)
  }

  // ── Parsing helpers ───────────────────────────────────────────────────────

  function parseLinesForFile(fileIdx: number): ScriptLineInput[] {
    const m = fileMappings[fileIdx]
    if (!m?.roleCol) return []
    const mapping: ScriptLineColumnMapping = {
      sheetIndex: m.selectedSheet,
      roleNameColumn: m.roleCol,
      timecodeColumn: m.timecodeCol !== NONE ? m.timecodeCol : undefined,
      sourceTextColumn: m.sourceCol !== NONE ? m.sourceCol : undefined,
      notesColumn: m.notesCol !== NONE ? m.notesCol : undefined,
    }
    return parseScriptLinesFromExcel(allFiles[fileIdx], mapping)
  }

  function parseStructuredLines(): ScriptLineInput[] {
    if (!sRoleCol || structuredSheets.length === 0) return []
    const sheet = structuredSheets[structuredSheet]
    const mapping: ScriptLineColumnMapping = {
      sheetIndex: structuredSheet,
      roleNameColumn: sRoleCol,
      timecodeColumn: sTimecodeCol !== NONE ? sTimecodeCol : undefined,
      sourceTextColumn: sSourceCol !== NONE ? sSourceCol : undefined,
      notesColumn: sNotesCol !== NONE ? sNotesCol : undefined,
    }
    return parseScriptLinesFromStructuredData(
      {
        headers: sheet.headers,
        rows: sheet.rows,
        source: structuredData?.[structuredSheet]?.source ?? "pdf-table",
        sheetName: sheet.name,
        totalRows: sheet.totalRows,
      },
      mapping
    )
  }

  // Preview lines for the active file/sheet
  const activeLines = useMemo(
    () => (isExcelMode ? parseLinesForFile(activeFile) : parseStructuredLines()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileMappings, activeFile, sRoleCol, sTimecodeCol, sSourceCol, sNotesCol, structuredSheet]
  )
  const previewLines = activeLines.slice(0, 8)

  // Total lines across ALL files (shown in footer)
  const totalAll = useMemo(
    () =>
      isExcelMode
        ? allFiles.reduce((sum, _, i) => sum + parseLinesForFile(i).length, 0)
        : parseStructuredLines().length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fileMappings, sRoleCol, sTimecodeCol, sSourceCol, sNotesCol, structuredSheet]
  )

  function handleImport() {
    if (totalAll === 0) return
    if (isExcelMode) {
      onImport(allFiles.flatMap((_, i) => parseLinesForFile(i)))
    } else {
      onImport(parseStructuredLines())
    }
  }

  // ── Dialog label ──────────────────────────────────────────────────────────
  const headerLabel =
    sourceLabel ??
    (isExcelMode
      ? isMultiFile
        ? `${allFiles.length} קבצי Excel`
        : allFiles[0]?.fileName ?? ""
      : structuredData?.[0]?.sheetName ?? "")

  // ── ColSelect helper ──────────────────────────────────────────────────────
  function ColSelect({
    value,
    onChange,
    required,
  }: {
    value: string
    onChange: (v: string) => void
    required?: boolean
  }) {
    return (
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>{"ללא"}</SelectItem>}
          {displayHeaders.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <DialogTitle>{"ייבוא שורות תסריט — סביבת עבודה"}</DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">{headerLabel}</p>
        </DialogHeader>

        {/* ── File tabs (multi-file Excel only) ────────────────────────── */}
        {isMultiFile && (
          <div className="flex gap-1 flex-wrap border-b pb-1 -mb-1">
            {allFiles.map((f, i) => {
              const count = fileMappings[i]?.roleCol ? parseLinesForFile(i).length : null
              return (
                <button
                  key={i}
                  onClick={() => setActiveFile(i)}
                  className={`px-3 py-1.5 text-sm rounded-t-md border-b-2 transition-colors ${
                    activeFile === i
                      ? "border-primary text-primary font-medium bg-primary/5"
                      : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/50"
                  }`}
                >
                  <span className="max-w-[160px] truncate inline-block align-bottom">
                    {f.fileName}
                  </span>
                  {count !== null && count > 0 && (
                    <Badge variant="secondary" className="mr-1.5 text-xs px-1.5 py-0">
                      {count}
                    </Badge>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── Sheet selector ────────────────────────────────────────────── */}
        {currentSheets.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-sm">{"גיליון"}</Label>
            <Select
              value={String(currentSelectedSheet)}
              onValueChange={(v) => handleCurrentSheetChange(Number(v))}
            >
              <SelectTrigger className="h-8 w-64 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {currentSheets.map((s) => (
                  <SelectItem key={s.index} value={String(s.index)}>
                    {s.name} ({s.totalRows} {"שורות"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* ── Column mapping grid ───────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 p-3 bg-muted/40 rounded-lg">
          <div>
            <Label className="text-xs">{"תפקיד"} *</Label>
            <ColSelect value={roleCol} onChange={setRoleCol} required />
          </div>
          <div>
            <Label className="text-xs">Timecode</Label>
            <ColSelect value={timecodeCol} onChange={setTimecodeCol} />
          </div>
          <div>
            <Label className="text-xs">{"טקסט מקור (אנגלית)"}</Label>
            <ColSelect value={sourceCol} onChange={setSourceCol} />
          </div>
          <div>
            <Label className="text-xs">{"הערות"}</Label>
            <ColSelect value={notesCol} onChange={setNotesCol} />
          </div>
        </div>

        {/* ── Preview (active file) ─────────────────────────────────────── */}
        <div className="space-y-2">
          {roleCol && previewLines.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">
                  {"תצוגה מקדימה"} ({activeLines.length} {"שורות"}
                  {isMultiFile && " בקובץ זה"})
                </span>
              </div>
              <div className="border rounded-lg overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">{"#"}</TableHead>
                      {timecodeCol !== NONE && <TableHead className="w-20">TC</TableHead>}
                      <TableHead>{"תפקיד"}</TableHead>
                      {sourceCol !== NONE && <TableHead>{"טקסט מקור"}</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-xs text-muted-foreground">{line.line_number}</TableCell>
                        {timecodeCol !== NONE && (
                          <TableCell className="text-xs font-mono">{line.timecode ?? "\u2014"}</TableCell>
                        )}
                        <TableCell className="font-medium text-sm">{line.role_name}</TableCell>
                        {sourceCol !== NONE && (
                          <TableCell className="text-sm max-w-[300px] truncate" dir="ltr">
                            {line.source_text ?? "\u2014"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {activeLines.length > 8 && (
                <p className="text-xs text-muted-foreground text-center">
                  {"מציג 8 מתוך"} {activeLines.length} {"שורות"}
                </p>
              )}
            </div>
          ) : roleCol ? (
            <div className="flex items-center gap-2 text-amber-600 p-3">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{"לא נמצאו שורות בעמודת התפקיד שנבחרה"}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground p-3">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">{"בחר עמודת תפקיד כדי לראות תצוגה מקדימה"}</span>
            </div>
          )}
        </div>

        {/* ── Footer ───────────────────────────────────────────────────── */}
        <div className="flex justify-between items-center pt-2 border-t">
          {isMultiFile && totalAll > 0 ? (
            <span className="text-sm text-muted-foreground">
              {"סה״כ מכל הקבצים:"}{" "}
              <strong>{totalAll}</strong> {"שורות"}
            </span>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              {"ביטול"}
            </Button>
            <Button onClick={handleImport} disabled={totalAll === 0 || isImporting}>
              {isImporting ? "מייבא..." : `ייבא ${totalAll} שורות`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
