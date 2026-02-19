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
import type { ScriptLineInput } from "@/lib/types"

interface ScriptLinesImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  excelResult: ExcelParseResult
  onImport: (lines: ScriptLineInput[]) => void
  isImporting?: boolean
}

const NONE = "__none__"

export function ScriptLinesImportDialog({
  open,
  onOpenChange,
  excelResult,
  onImport,
  isImporting = false,
}: ScriptLinesImportDialogProps) {
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [timecodeCol, setTimecodeCol] = useState<string>(NONE)
  const [roleCol, setRoleCol] = useState<string>("")
  const [sourceCol, setSourceCol] = useState<string>(NONE)
  const [translationCol, setTranslationCol] = useState<string>(NONE)
  const [recStatusCol, setRecStatusCol] = useState<string>(NONE)
  const [notesCol, setNotesCol] = useState<string>(NONE)

  const sheet = excelResult.sheets[selectedSheet]
  const headers = sheet?.headers ?? []

  // Auto-detect columns when sheet changes
  useEffect(() => {
    if (headers.length === 0) return
    const detected = autoDetectScriptLineColumns(headers)
    setTimecodeCol(detected.timecodeColumn ?? NONE)
    setRoleCol(detected.roleNameColumn ?? "")
    setSourceCol(detected.sourceTextColumn ?? NONE)
    setTranslationCol(detected.translationColumn ?? NONE)
    setRecStatusCol(detected.recStatusColumn ?? NONE)
    setNotesCol(detected.notesColumn ?? NONE)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSheet, excelResult])

  const mapping = useMemo<ScriptLineColumnMapping>(() => ({
    sheetIndex: selectedSheet,
    timecodeColumn: timecodeCol !== NONE ? timecodeCol : undefined,
    roleNameColumn: roleCol,
    sourceTextColumn: sourceCol !== NONE ? sourceCol : undefined,
    translationColumn: translationCol !== NONE ? translationCol : undefined,
    recStatusColumn: recStatusCol !== NONE ? recStatusCol : undefined,
    notesColumn: notesCol !== NONE ? notesCol : undefined,
  }), [selectedSheet, timecodeCol, roleCol, sourceCol, translationCol, recStatusCol, notesCol])

  const previewLines = useMemo(() => {
    if (!roleCol) return []
    const allLines = parseScriptLinesFromExcel(excelResult, mapping)
    return allLines.slice(0, 8)
  }, [excelResult, mapping, roleCol])

  const totalLines = useMemo(() => {
    if (!roleCol) return 0
    return parseScriptLinesFromExcel(excelResult, mapping).length
  }, [excelResult, mapping, roleCol])

  function handleImport() {
    if (!roleCol || totalLines === 0) return
    const lines = parseScriptLinesFromExcel(excelResult, mapping)
    onImport(lines)
  }

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
        <SelectTrigger className="text-sm">
          <SelectValue placeholder={required ? "בחר עמודה..." : "ללא"} />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>ללא</SelectItem>}
          {headers.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-5xl"
        dir="rtl"
        style={{ display: "flex", flexDirection: "column", maxHeight: "92vh" }}
      >
        {/* Header */}
        <div className="flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              ייבוא שורות תסריט — סביבת עבודה
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground mt-1">
            {excelResult.fileName} · {excelResult.totalRows} שורות
          </p>

          {/* Sheet selector */}
          {excelResult.sheets.length > 1 && (
            <div className="mt-3 space-y-1">
              <Label className="text-xs text-muted-foreground">גיליון</Label>
              <Select
                value={String(selectedSheet)}
                onValueChange={(v) => setSelectedSheet(Number(v))}
              >
                <SelectTrigger className="w-56">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {excelResult.sheets.map((s, i) => (
                    <SelectItem key={i} value={String(i)}>
                      {s.name} ({s.rows.length} שורות)
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Column mapping grid */}
          <div className="mt-4 grid grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">
                תפקיד <span className="text-destructive">*</span>
              </Label>
              <ColSelect value={roleCol} onChange={setRoleCol} required />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Timecode</Label>
              <ColSelect value={timecodeCol} onChange={setTimecodeCol} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">סטטוס הקלטה (REC)</Label>
              <ColSelect value={recStatusCol} onChange={setRecStatusCol} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">טקסט מקור (אנגלית)</Label>
              <ColSelect value={sourceCol} onChange={setSourceCol} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">תרגום (עברית)</Label>
              <ColSelect value={translationCol} onChange={setTranslationCol} />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">הערות</Label>
              <ColSelect value={notesCol} onChange={setNotesCol} />
            </div>
          </div>
        </div>

        {/* Preview */}
        <div className="flex-1 overflow-y-auto min-h-0 mt-4 space-y-3">
          {roleCol && previewLines.length > 0 ? (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                תצוגה מקדימה ({totalLines} שורות)
              </h4>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right w-10">#</TableHead>
                      {timecodeCol !== NONE && (
                        <TableHead className="text-right w-32">TC</TableHead>
                      )}
                      <TableHead className="text-right w-36">תפקיד</TableHead>
                      {recStatusCol !== NONE && (
                        <TableHead className="text-right w-24">REC</TableHead>
                      )}
                      {sourceCol !== NONE && (
                        <TableHead className="text-right">טקסט מקור</TableHead>
                      )}
                      {translationCol !== NONE && (
                        <TableHead className="text-right">תרגום</TableHead>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {previewLines.map((line, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-right text-muted-foreground text-xs">
                          {line.line_number}
                        </TableCell>
                        {timecodeCol !== NONE && (
                          <TableCell className="text-right font-mono text-xs">
                            {line.timecode ?? "—"}
                          </TableCell>
                        )}
                        <TableCell className="text-right font-medium text-sm">
                          {line.role_name}
                        </TableCell>
                        {recStatusCol !== NONE && (
                          <TableCell className="text-right">
                            {line.rec_status ? (
                              <Badge
                                variant={
                                  line.rec_status === "הוקלט"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {line.rec_status}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        )}
                        {sourceCol !== NONE && (
                          <TableCell className="text-right text-sm max-w-[200px] truncate">
                            {line.source_text ?? "—"}
                          </TableCell>
                        )}
                        {translationCol !== NONE && (
                          <TableCell className="text-right text-sm max-w-[200px] truncate">
                            {line.translation ?? "—"}
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalLines > 8 && (
                <p className="text-xs text-muted-foreground mt-1">
                  מציג 8 מתוך {totalLines} שורות
                </p>
              )}
            </div>
          ) : roleCol ? (
            <div className="flex items-center gap-2 text-amber-600 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">לא נמצאו שורות בעמודת התפקיד שנבחרה</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-muted-foreground p-3 bg-muted/40 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">בחר עמודת תפקיד כדי לראות תצוגה מקדימה</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={handleImport}
            disabled={!roleCol || totalLines === 0 || isImporting}
          >
            {isImporting ? "מייבא..." : `ייבא ${totalLines} שורות`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
