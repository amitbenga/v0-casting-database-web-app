"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { Upload, Download, Search, X, FileSpreadsheet, Loader2 } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ScriptLine, ScriptLineInput, RecStatus } from "@/lib/types"
import { saveScriptLines, updateScriptLine, getScriptLines } from "@/lib/actions/script-line-actions"
import { parseExcelFile } from "@/lib/parser/excel-parser"
import { ScriptLinesImportDialog } from "./script-lines-import-dialog"
import type { ExcelParseResult } from "@/lib/parser/excel-parser"

interface ScriptWorkspaceTabProps {
  projectId: string
}

// Color palette for roles
const ROLE_COLORS = [
  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300",
  "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300",
  "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/40 dark:text-cyan-300",
  "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
  "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "bg-indigo-100 text-indigo-800 dark:bg-indigo-900/40 dark:text-indigo-300",
  "bg-teal-100 text-teal-800 dark:bg-teal-900/40 dark:text-teal-300",
]

function getRoleColor(roleName: string, roleIndex: Map<string, number>): string {
  const idx = roleIndex.get(roleName) ?? 0
  return ROLE_COLORS[idx % ROLE_COLORS.length]
}

// REC status badge
const REC_STATUS_CONFIG: Record<RecStatus, { label: string; className: string }> = {
  "הוקלט": { label: "הוקלט", className: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300" },
  "Optional": { label: "Optional", className: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300" },
  "לא הוקלט": { label: "לא הוקלט", className: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300" },
}

const REC_STATUS_OPTIONS: Array<{ value: string; label: string }> = [
  { value: "הוקלט", label: "הוקלט" },
  { value: "Optional", label: "Optional" },
  { value: "לא הוקלט", label: "לא הוקלט" },
]

// Inline translation cell
function TranslationCell({
  lineId,
  value,
  onChange,
}: {
  lineId: string
  value: string | undefined
  onChange: (lineId: string, newValue: string) => void
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")
  const inputRef = useRef<HTMLTextAreaElement>(null)

  function startEdit() {
    setDraft(value ?? "")
    setEditing(true)
    setTimeout(() => inputRef.current?.focus(), 0)
  }

  function commit() {
    setEditing(false)
    if (draft !== (value ?? "")) {
      onChange(lineId, draft)
    }
  }

  if (editing) {
    return (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault()
            commit()
          }
          if (e.key === "Escape") {
            setEditing(false)
          }
        }}
        className="w-full min-h-[60px] p-1 text-sm border rounded resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        dir="rtl"
      />
    )
  }

  return (
    <div onClick={startEdit} className="cursor-pointer min-h-[40px] p-1 text-sm hover:bg-muted/50 rounded transition-colors whitespace-pre-wrap" dir="rtl">
      {value || <span className="text-muted-foreground italic">{"לחץ לעריכה..."}</span>}
    </div>
  )
}

// Main component
export function ScriptWorkspaceTab({ projectId }: ScriptWorkspaceTabProps) {
  const { toast } = useToast()

  const [lines, setLines] = useState<ScriptLine[]>([])
  const [loading, setLoading] = useState(true)
  const [searchRole, setSearchRole] = useState("")

  // Load lines on mount
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getScriptLines(projectId)
      .then((data) => {
        if (!cancelled) setLines(data)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [projectId])

  const [filterRole, setFilterRole] = useState<string>("__all__")
  const [filterStatus, setFilterStatus] = useState<string>("__all__")
  const [isImporting, setIsImporting] = useState(false)
  const [excelResult, setExcelResult] = useState<ExcelParseResult | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Build a stable role color index map
  const roleIndex = useMemo(() => {
    const map = new Map<string, number>()
    lines.forEach((line) => {
      if (!map.has(line.role_name)) {
        map.set(line.role_name, map.size)
      }
    })
    return map
  }, [lines])

  // Unique roles for filter dropdown
  const uniqueRoles = useMemo(() => {
    return Array.from(roleIndex.keys()).sort((a, b) => a.localeCompare(b, "he"))
  }, [roleIndex])

  // Replica count per role
  const replicaCounts = useMemo(() => {
    const counts = new Map<string, number>()
    lines.forEach((l) => counts.set(l.role_name, (counts.get(l.role_name) ?? 0) + 1))
    return counts
  }, [lines])

  // Filtered lines
  const filteredLines = useMemo(() => {
    return lines.filter((line) => {
      if (filterRole !== "__all__" && line.role_name !== filterRole) return false
      if (filterStatus !== "__all__") {
        if (filterStatus === "pending" && line.rec_status != null) return false
        if (filterStatus !== "pending" && line.rec_status !== filterStatus) return false
      }
      if (searchRole) {
        const q = searchRole.toLowerCase()
        const inRole = line.role_name.toLowerCase().includes(q)
        const inSource = (line.source_text ?? "").toLowerCase().includes(q)
        const inTranslation = (line.translation ?? "").toLowerCase().includes(q)
        if (!inRole && !inSource && !inTranslation) return false
      }
      return true
    })
  }, [lines, filterRole, filterStatus, searchRole])

  // File selection
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ""

    try {
      const result = await parseExcelFile(file)
      if (result.sheets.length === 0) {
        toast({ title: "שגיאה", description: "לא נמצאו גיליונות בקובץ", variant: "destructive" })
        return
      }
      setExcelResult(result)
      setShowImportDialog(true)
    } catch (err) {
      console.error(err)
      toast({ title: "שגיאה", description: "לא ניתן לקרוא את הקובץ", variant: "destructive" })
    }
  }

  // Import confirmed
  const handleImport = useCallback(
    async (importedLines: ScriptLineInput[]) => {
      setIsImporting(true)
      try {
        const result = await saveScriptLines(projectId, importedLines, {
          replaceAll: true,
        })
        if (!result.success) throw new Error(result.error)

        setShowImportDialog(false)
        setExcelResult(null)
        const freshLines = await getScriptLines(projectId)
        setLines(freshLines)
        toast({
          title: "ייבוא הצליח",
          description: `${result.linesCreated} שורות יובאו לסביבת העבודה`,
        })
      } catch (err) {
        console.error(err)
        toast({ title: "שגיאת ייבוא", description: String(err), variant: "destructive" })
      } finally {
        setIsImporting(false)
      }
    },
    [projectId, toast]
  )

  // Inline translation update
  const handleTranslationChange = useCallback(
    async (lineId: string, newTranslation: string) => {
      setLines((prev) =>
        prev.map((l) =>
          l.id === lineId ? { ...l, translation: newTranslation } : l
        )
      )
      const result = await updateScriptLine(lineId, { translation: newTranslation })
      if (!result.success) {
        toast({ title: "שגיאה", description: "שגיאה בשמירת תרגום", variant: "destructive" })
      }
    },
    [toast]
  )

  // Excel export
  async function handleExport() {
    try {
      const XLSX = await import("xlsx")
      const exportData = lines.map((l) => ({
        "#": l.line_number ?? "",
        TC: l.timecode ?? "",
        "תפקיד": l.role_name,
        "סטטוס הקלטה": l.rec_status ?? "",
        "תרגום": l.translation ?? "",
        "טקסט מקור": l.source_text ?? "",
        "הערות": l.notes ?? "",
      }))
      const ws = XLSX.utils.json_to_sheet(exportData)
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "Script Workspace")
      XLSX.writeFile(wb, `workspace-${projectId}.xlsx`)
      toast({ title: "ייצוא הצליח" })
    } catch {
      toast({ title: "שגיאה בייצוא", variant: "destructive" })
    }
  }

  const hasLines = lines.length > 0

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls" className="hidden" onChange={handleFileSelect} />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
          <Upload className="h-4 w-4" />
          {"ייבא Excel"}
        </Button>

        {hasLines && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            {"ייצא Excel"}
          </Button>
        )}

        <div className="flex-1" />

        {hasLines && (
          <span className="text-sm text-muted-foreground">
            {filteredLines.length.toLocaleString()} / {lines.length.toLocaleString()} {"שורות"}
          </span>
        )}
      </div>

      {/* Filters */}
      {!loading && hasLines && (
        <div className="flex items-center gap-2 flex-wrap">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="חיפוש..."
              value={searchRole}
              onChange={(e) => setSearchRole(e.target.value)}
              className="pr-7 h-8 text-sm w-48"
            />
            {searchRole && (
              <button onClick={() => setSearchRole("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <Select value={filterRole} onValueChange={setFilterRole}>
            <SelectTrigger className="h-8 w-40 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{"כל התפקידים"}</SelectItem>
              {uniqueRoles.map((role) => (
                <SelectItem key={role} value={role}>
                  {role}
                  <span className="text-muted-foreground mr-1">
                    ({replicaCounts.get(role)})
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 text-sm">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{"כל הסטטוסים"}</SelectItem>
              <SelectItem value="pending">{"ממתין"}</SelectItem>
              {REC_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {(filterRole !== "__all__" || filterStatus !== "__all__" || searchRole) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterRole("__all__")
                setFilterStatus("__all__")
                setSearchRole("")
              }}
              className="h-8 gap-1 text-muted-foreground"
            >
              <X className="h-3.5 w-3.5" />
              {"נקה"}
            </Button>
          )}
        </div>
      )}

      {/* Role counts summary */}
      {!loading && hasLines && filterRole === "__all__" && !searchRole && (
        <div className="flex flex-wrap gap-1.5">
          <TooltipProvider>
            {uniqueRoles.map((role) => (
              <Tooltip key={role}>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => setFilterRole(role)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium transition-opacity hover:opacity-80 ${getRoleColor(role, roleIndex)}`}
                  >
                    {role}
                    <span className="opacity-60">{replicaCounts.get(role)}</span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>{"סנן לפי"} {role}</TooltipContent>
              </Tooltip>
            ))}
          </TooltipProvider>
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-8 w-8 animate-spin" />
          <span>{"טוען שורות תסריט..."}</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && !hasLines && (
        <div className="flex flex-col items-center justify-center py-16 text-center gap-4">
          <FileSpreadsheet className="h-12 w-12 text-muted-foreground" />
          <p className="text-lg font-medium">{"סביבת העבודה ריקה"}</p>
          <p className="text-sm text-muted-foreground">{"ייבא קובץ Excel של תסריט הדיבוב כדי להתחיל"}</p>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 ml-2" />
            {"ייבא Excel"}
          </Button>
        </div>
      )}

      {/* Lines table */}
      {!loading && hasLines && (
        <div className="border rounded-lg overflow-auto max-h-[calc(100vh-300px)]">
          <Table>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="w-12 text-center">{"#"}</TableHead>
                <TableHead className="w-24">{"TC"}</TableHead>
                <TableHead className="w-32">{"תפקיד"}</TableHead>
                <TableHead className="w-28">{"שחקן"}</TableHead>
                <TableHead className="w-24">{"סטטוס"}</TableHead>
                <TableHead className="min-w-[200px]">{"תרגום"}</TableHead>
                <TableHead className="min-w-[200px]">{"טקסט מקור"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredLines.map((line) => {
                const recConfig = line.rec_status
                  ? REC_STATUS_CONFIG[line.rec_status]
                  : null
                return (
                  <TableRow key={line.id} className="hover:bg-muted/30">
                    <TableCell className="text-center text-xs text-muted-foreground">
                      {line.line_number ?? ""}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">
                      {line.timecode ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className={`text-xs ${getRoleColor(line.role_name, roleIndex)}`}>
                        {line.role_name}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {line.actor_name ? (
                        <span className="font-medium">{line.actor_name}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs italic">{"לא שובץ"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {recConfig ? (
                        <Badge variant="secondary" className={`text-xs ${recConfig.className}`}>
                          {recConfig.label}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">{"ממתין"}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <TranslationCell lineId={line.id} value={line.translation} onChange={handleTranslationChange} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground whitespace-pre-wrap" dir="ltr">
                      {line.source_text ?? ""}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
          {filteredLines.length === 0 && (
            <p className="text-center py-8 text-muted-foreground">{"לא נמצאו שורות התואמות לסינון"}</p>
          )}
        </div>
      )}

      {/* Import dialog */}
      {excelResult && (
        <ScriptLinesImportDialog
          open={showImportDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowImportDialog(false)
              setExcelResult(null)
            }
          }}
          excelResult={excelResult}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}
    </div>
  )
}
