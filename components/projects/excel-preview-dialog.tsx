"use client"

import { useState, useMemo } from "react"
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
import { FileSpreadsheet, CheckCircle, AlertCircle } from "lucide-react"
import type {
  ExcelParseResult,
  ExcelColumnMapping,
  ExcelMappedRole,
} from "@/lib/parser/excel-parser"
import { applyExcelMapping } from "@/lib/parser/excel-parser"

interface ExcelPreviewDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  excelResult: ExcelParseResult
  onApply: (roles: ExcelMappedRole[]) => void
  isApplying?: boolean
}

export function ExcelPreviewDialog({
  open,
  onOpenChange,
  excelResult,
  onApply,
  isApplying = false,
}: ExcelPreviewDialogProps) {
  const [selectedSheet, setSelectedSheet] = useState(0)
  const [roleNameColumn, setRoleNameColumn] = useState<string>("")
  const [replicasColumn, setReplicasColumn] = useState<string>("")

  const sheet = excelResult.sheets[selectedSheet]
  const headers = sheet?.headers || []

  // Auto-detect columns on first load
  useState(() => {
    if (headers.length > 0 && !roleNameColumn) {
      // Try to auto-detect role name column
      const roleNameGuess = headers.find(
        (h) =>
          /role|תפקיד|שם|name|character|דמות/i.test(h)
      )
      if (roleNameGuess) setRoleNameColumn(roleNameGuess)

      // Try to auto-detect replicas column
      const replicasGuess = headers.find(
        (h) =>
          /replica|רפליק|כמות|count|lines|שורות|משפטים/i.test(h)
      )
      if (replicasGuess) setReplicasColumn(replicasGuess)
    }
  })

  // Preview the mapped roles
  const mappedRoles = useMemo(() => {
    if (!roleNameColumn) return []
    return applyExcelMapping(excelResult, {
      roleNameColumn,
      replicasColumn: replicasColumn || undefined,
      sheetIndex: selectedSheet,
    })
  }, [excelResult, roleNameColumn, replicasColumn, selectedSheet])

  const handleApply = () => {
    if (mappedRoles.length === 0) return
    onApply(mappedRoles)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-w-4xl"
        dir="rtl"
        style={{ display: "flex", flexDirection: "column", maxHeight: "90vh" }}
      >
        {/* Header - fixed */}
        <div className="flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet className="h-5 w-5" />
              ייבוא תפקידים מ-Excel
            </DialogTitle>
          </DialogHeader>

          <p className="text-sm text-muted-foreground mt-2">
            קובץ: {excelResult.fileName} ({excelResult.totalRows} שורות)
          </p>

          {/* Sheet selector (if multiple sheets) */}
          {excelResult.sheets.length > 1 && (
            <div className="mt-3 space-y-1">
              <Label>גיליון</Label>
              <Select
                value={String(selectedSheet)}
                onValueChange={(v) => {
                  setSelectedSheet(Number(v))
                  setRoleNameColumn("")
                  setReplicasColumn("")
                }}
              >
                <SelectTrigger className="w-48">
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

          {/* Column mapping */}
          <div className="mt-4 grid grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>עמודת שם תפקיד *</Label>
              <Select value={roleNameColumn} onValueChange={setRoleNameColumn}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר עמודה..." />
                </SelectTrigger>
                <SelectContent>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>עמודת כמות רפליקות (אופציונלי)</Label>
              <Select
                value={replicasColumn}
                onValueChange={setReplicasColumn}
              >
                <SelectTrigger>
                  <SelectValue placeholder="ברירת מחדל: 1" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">ללא (ברירת מחדל: 1)</SelectItem>
                  {headers.map((h) => (
                    <SelectItem key={h} value={h}>
                      {h}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto min-h-0 mt-4 space-y-4">
          {/* Raw data preview */}
          {sheet && (
            <div>
              <h4 className="text-sm font-medium mb-2">תצוגה מקדימה של הנתונים</h4>
              <div className="border rounded-lg overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {headers.map((h) => (
                        <TableHead
                          key={h}
                          className={`text-right ${
                            h === roleNameColumn
                              ? "bg-blue-50 dark:bg-blue-950"
                              : h === replicasColumn
                                ? "bg-green-50 dark:bg-green-950"
                                : ""
                          }`}
                        >
                          {h}
                          {h === roleNameColumn && (
                            <Badge variant="secondary" className="mr-1 text-xs">
                              שם
                            </Badge>
                          )}
                          {h === replicasColumn && (
                            <Badge variant="secondary" className="mr-1 text-xs">
                              רפליקות
                            </Badge>
                          )}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sheet.preview.map((row, i) => (
                      <TableRow key={i}>
                        {headers.map((h) => (
                          <TableCell
                            key={h}
                            className={`text-right ${
                              h === roleNameColumn
                                ? "bg-blue-50/50 dark:bg-blue-950/50 font-medium"
                                : h === replicasColumn
                                  ? "bg-green-50/50 dark:bg-green-950/50"
                                  : ""
                            }`}
                          >
                            {row[h] != null ? String(row[h]) : "—"}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {sheet.rows.length > 10 && (
                <p className="text-xs text-muted-foreground mt-1">
                  מציג 10 מתוך {sheet.rows.length} שורות
                </p>
              )}
            </div>
          )}

          {/* Mapped roles preview */}
          {roleNameColumn && mappedRoles.length > 0 && (
            <div>
              <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-600" />
                תפקידים שזוהו ({mappedRoles.length})
              </h4>
              <div className="border rounded-lg overflow-x-auto max-h-[200px] overflow-y-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">שם תפקיד</TableHead>
                      <TableHead className="text-right w-24">רפליקות</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {mappedRoles.map((role, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-right font-medium">
                          {role.role_name}
                        </TableCell>
                        <TableCell className="text-right">
                          {role.replicas_count}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}

          {roleNameColumn && mappedRoles.length === 0 && (
            <div className="flex items-center gap-2 text-amber-600 p-3 bg-amber-50 dark:bg-amber-950 rounded-lg">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">לא נמצאו תפקידים בעמודה שנבחרה</span>
            </div>
          )}
        </div>

        {/* Footer - fixed */}
        <div className="flex-shrink-0 flex items-center justify-between pt-4 border-t bg-background">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button
            onClick={handleApply}
            disabled={!roleNameColumn || mappedRoles.length === 0 || isApplying}
          >
            {isApplying
              ? "מחיל..."
              : `החל ${mappedRoles.length} תפקידים`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
