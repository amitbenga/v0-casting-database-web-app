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
        <SelectTrigger className="h-8 text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {!required && <SelectItem value={NONE}>{"ללא"}</SelectItem>}
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
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="h-5 w-5 text-primary" />
            <DialogTitle>
              {"ייבוא שורות תסריט — סביבת עבודה"}
            </DialogTitle>
          </div>
          <p className="text-sm text-muted-foreground">
            {excelResult.fileName} {"\u00B7"} {excelResult.totalRows} {"שורות"}
          </p>
        </DialogHeader>

        {/* Sheet selector */}
        {excelResult.sheets.length > 1 && (
          <div className="flex items-center gap-2">
            <Label className="text-sm">{"גיליון"}</Label>
            <Select value={String(selectedSheet)} onValueChange={(v) => setSelectedSheet(Number(v))}>
              <SelectTrigger className="h-8 w-60 text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {excelResult.sheets.map((s, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {s.name} ({s.rows.length} {"שורות"})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Column mapping grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 p-3 bg-muted/40 rounded-lg">
          <div>
            <Label className="text-xs">{"תפקיד"} *</Label>
            <ColSelect value={roleCol} onChange={setRoleCol} required />
          </div>
          <div>
            <Label className="text-xs">Timecode</Label>
            <ColSelect value={timecodeCol} onChange={setTimecodeCol} />
          </div>
          <div>
            <Label className="text-xs">{"סטטוס הקלטה (REC)"}</Label>
            <ColSelect value={recStatusCol} onChange={setRecStatusCol} />
          </div>
          <div>
            <Label className="text-xs">{"טקסט מקור (אנגלית)"}</Label>
            <ColSelect value={sourceCol} onChange={setSourceCol} />
          </div>
          <div>
            <Label className="text-xs">{"תרגום (עברית)"}</Label>
            <ColSelect value={translationCol} onChange={setTranslationCol} />
          </div>
          <div>
            <Label className="text-xs">{"הערות"}</Label>
            <ColSelect value={notesCol} onChange={setNotesCol} />
          </div>
        </div>

        {/* Preview */}
        <div className="space-y-2">
          {roleCol && previewLines.length > 0 ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                <span className="text-sm font-medium">{"תצוגה מקדימה"} ({totalLines} {"שורות"})</span>
              </div>
              <div className="border rounded-lg overflow-auto max-h-64">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-10">{"#"}</TableHead>
                      {timecodeCol !== NONE && <TableHead className="w-20">TC</TableHead>}
                      <TableHead>{"תפקיד"}</TableHead>
                      {recStatusCol !== NONE && <TableHead className="w-20">REC</TableHead>}
                      {sourceCol !== NONE && <TableHead>{"טקסט מקור"}</TableHead>}
                      {translationCol !== NONE && <TableHead>{"תרגום"}</TableHead>}
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
                        {recStatusCol !== NONE && (
                          <TableCell>
                            {line.rec_status ? (
                              <Badge variant="secondary" className="text-xs">{line.rec_status}</Badge>
                            ) : (
                              <span className="text-xs text-muted-foreground">{"\u2014"}</span>
                            )}
                          </TableCell>
                        )}
                        {sourceCol !== NONE && (
                          <TableCell className="text-sm max-w-[200px] truncate" dir="ltr">{line.source_text ?? "\u2014"}</TableCell>
                        )}
                        {translationCol !== NONE && (
                          <TableCell className="text-sm max-w-[200px] truncate" dir="rtl">{line.translation ?? "\u2014"}</TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {totalLines > 8 && (
                <p className="text-xs text-muted-foreground text-center">
                  {"מציג 8 מתוך"} {totalLines} {"שורות"}
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

        {/* Footer */}
        <div className="flex justify-end gap-2 pt-2 border-t">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {"ביטול"}
          </Button>
          <Button onClick={handleImport} disabled={!roleCol || totalLines === 0 || isImporting}>
            {isImporting ? "מייבא..." : `ייבא ${totalLines} שורות`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
