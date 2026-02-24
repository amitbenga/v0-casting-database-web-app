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
import { Upload, Download, Search, X, FileSpreadsheet, Loader2, Hash } from "lucide-react"
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

// Searchable role combobox (Agent 5)
function RoleCombobox({
  value,
  onChange,
  roles,
  replicaCounts,
}: {
  value: string
  onChange: (v: string) => void
  roles: string[]
  replicaCounts: Map<string, number>
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState("")
  const containerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const filtered = useMemo(() => {
    if (!query) return roles
    const q = query.toLowerCase()
    return roles.filter((r) => r.toLowerCase().includes(q))
  }, [roles, query])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        setQuery("")
      }
    }
    if (open) {
      document.addEventListener("mousedown", handleClick)
      return () => document.removeEventListener("mousedown", handleClick)
    }
  }, [open])

  const selectedLabel = value === "__all__" ? "כל התפקידים" : value

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => {
          setOpen((prev) => !prev)
          setQuery("")
          setTimeout(() => inputRef.current?.focus(), 0)
        }}
        className="flex items-center justify-between h-8 w-48 text-sm border rounded-md px-3 bg-background hover:bg-muted/50 transition-colors gap-2"
        dir="rtl"
      >
        <span className="truncate text-right flex-1">{selectedLabel}</span>
        <svg className="h-4 w-4 opacity-50 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1 z-50 w-56 bg-popover border rounded-md shadow-lg overflow-hidden" dir="rtl" style={{ right: 0 }}>
          <div className="p-1.5 border-b">
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="חיפוש תפקיד..."
              className="w-full h-7 text-sm px-2 rounded border-0 bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              dir="rtl"
            />
          </div>
          <div className="max-h-56 overflow-y-auto">
            <button
              type="button"
              onClick={() => { onChange("__all__"); setOpen(false); setQuery("") }}
              className={`w-full text-right px-3 py-1.5 text-sm hover:bg-muted/70 transition-colors ${value === "__all__" ? "bg-muted font-medium" : ""}`}
            >
              כל התפקידים
            </button>
            {filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-muted-foreground text-right">לא נמצאו תפקידים</p>
            )}
            {filtered.map((role) => (
              <button
                key={role}
                type="button"
                onClick={() => { onChange(role); setOpen(false); setQuery("") }}
                className={`w-full text-right px-3 py-1.5 text-sm hover:bg-muted/70 transition-colors flex items-center justify-between gap-2 ${value === role ? "bg-muted font-medium" : ""}`}
              >
                <span className="truncate">{role}</span>
                <span className="text-xs text-muted-foreground flex-shrink-0">({replicaCounts.get(role)})</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

const PAGE_SIZE = 1000

// Main component
export function ScriptWorkspaceTab({ projectId }: ScriptWorkspaceTabProps) {
  const { toast } = useToast()

  const [lines, setLines] = useState<ScriptLine[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [searchRole, setSearchRole] = useState("")

  // Load initial page of lines
  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getScriptLines(projectId, {}, { from: 0, to: PAGE_SIZE - 1 })
      .then(({ lines: data, total: count }) => {
        if (!cancelled) {
          setLines(data)
          setTotal(count)
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [projectId])

  const hasMore = lines.length < total

  async function loadMore() {
    if (loadingMore || !hasMore) return
    setLoadingMore(true)
    try {
      const { lines: more } = await getScriptLines(projectId, {}, { from: lines.length, to: lines.length + PAGE_SIZE - 1 })
      setLines((prev) => [...prev, ...more])
    } finally {
      setLoadingMore(false)
    }
  }

  const [filterRole, setFilterRole] = useState<string>("__all__")
  const [filterStatus, setFilterStatus] = useState<string>("__all__")
  const [isImporting, setIsImporting] = useState(false)
  const [excelResult, setExcelResult] = useState<ExcelParseResult | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Jump-to-line (Agent 6)
  const [jumpToLine, setJumpToLine] = useState("")
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  function handleJumpToLine() {
    const num = parseInt(jumpToLine)
    if (isNaN(num)) return
    // Find the row with this line number in filteredLines
    const idx = filteredLines.findIndex((l) => l.line_number === num)
    if (idx === -1) {
      toast({ title: "שורה לא נמצאה", description: `שורה מספר ${num} לא קיימת`, variant: "destructive" })
      return
    }
    // Scroll to the row in the container
    if (tableBodyRef.current && tableContainerRef.current) {
      const rows = tableBodyRef.current.querySelectorAll("tr")
      const targetRow = rows[idx] as HTMLTableRowElement | undefined
      if (targetRow) {
        tableContainerRef.current.scrollTo({ top: targetRow.offsetTop - 48, behavior: "smooth" })
      }
    }
  }

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
    return Array.from<string>(roleIndex.keys()).sort((a, b) => a.localeCompare(b, "he"))
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
        const { lines: freshLines, total: freshTotal } = await getScriptLines(projectId, {}, { from: 0, to: PAGE_SIZE - 1 })
        setLines(freshLines)
        setTotal(freshTotal)
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
    <div className="space-y-4 w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap" dir="rtl">
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
            {filteredLines.length.toLocaleString()} / {total.toLocaleString()} {"שורות"}
            {hasMore && ` (${lines.length.toLocaleString()} טעונות)`}
          </span>
        )}
      </div>

      {/* Filters (Agent 5: combobox for role; Agent 6: jump-to-line) */}
      {!loading && hasLines && (
        <div className="flex items-center gap-2 flex-wrap" dir="rtl">
          {/* Search text */}
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="חיפוש..."
              value={searchRole}
              onChange={(e) => setSearchRole(e.target.value)}
              className="pr-7 h-8 text-sm w-44"
              dir="rtl"
            />
            {searchRole && (
              <button onClick={() => setSearchRole("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Searchable role combobox (Agent 5) */}
          <RoleCombobox
            value={filterRole}
            onChange={setFilterRole}
            roles={uniqueRoles}
            replicaCounts={replicaCounts}
          />

          {/* Status filter */}
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="h-8 w-36 text-sm" dir="rtl">
              <SelectValue />
            </SelectTrigger>
            <SelectContent dir="rtl">
              <SelectItem value="__all__">{"כל הסטטוסים"}</SelectItem>
              <SelectItem value="pending">{"ממתין"}</SelectItem>
              {REC_STATUS_OPTIONS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Clear filters */}
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

          <div className="flex-1" />

          {/* Jump-to-line (Agent 6) */}
          <div className="flex items-center gap-1">
            <Hash className="h-3.5 w-3.5 text-muted-foreground" />
            <Input
              type="number"
              min={1}
              placeholder="קפוץ לשורה"
              value={jumpToLine}
              onChange={(e) => setJumpToLine(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJumpToLine() }}
              className="h-8 w-28 text-sm"
              dir="rtl"
            />
            <Button variant="outline" size="sm" className="h-8" onClick={handleJumpToLine}>
              {"קפוץ"}
            </Button>
          </div>
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

      {/* Lines table — Agent 4: RTL, Agent 6: full-width */}
      {!loading && hasLines && (
        <div
          ref={tableContainerRef}
          className="border rounded-lg overflow-auto max-h-[calc(100vh-280px)] w-full"
          dir="rtl"
        >
          <Table className="w-full" style={{ direction: "rtl" }}>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                {/* # — sticky right (Agent 4) */}
                <TableHead className="w-12 text-right sticky right-0 z-20 bg-background border-l">{"#"}</TableHead>
                <TableHead className="w-24 text-right">{"TC"}</TableHead>
                <TableHead className="w-32 text-right">{"תפקיד"}</TableHead>
                <TableHead className="w-28 text-right">{"שחקן"}</TableHead>
                <TableHead className="w-24 text-right">{"סטטוס"}</TableHead>
                <TableHead className="min-w-[200px] text-right">{"תרגום"}</TableHead>
                <TableHead className="min-w-[200px] text-right" dir="ltr">{"טקסט מקור"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody ref={tableBodyRef}>
              {filteredLines.map((line) => {
                const recConfig = line.rec_status
                  ? REC_STATUS_CONFIG[line.rec_status]
                  : null
                return (
                  <TableRow key={line.id} className="hover:bg-muted/30">
                    {/* # — sticky right (Agent 4) */}
                    <TableCell className="text-right text-xs text-muted-foreground sticky right-0 z-10 bg-background border-l">
                      {line.line_number ?? ""}
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground text-right">
                      {line.timecode ?? "\u2014"}
                    </TableCell>
                    <TableCell className="max-w-[130px]">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge variant="secondary" className={`text-xs max-w-full truncate block ${getRoleColor(line.role_name, roleIndex)}`}>
                              {line.role_name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" dir="rtl">{line.role_name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-sm text-right">
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

      {/* Load more (pagination) — Task 2A/2B */}
      {!loading && hasMore && (
        <div className="flex justify-center pt-2">
          <Button variant="outline" size="sm" onClick={loadMore} disabled={loadingMore} className="gap-2">
            {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {loadingMore ? "טוען..." : `טען עוד (${(total - lines.length).toLocaleString()} נותרו)`}
          </Button>
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
