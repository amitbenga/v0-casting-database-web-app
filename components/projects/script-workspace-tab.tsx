"use client"

import { useState, useCallback, useMemo, useRef, useEffect } from "react"
import { useVirtualizer } from "@tanstack/react-virtual"
import { useDebounce } from "@/hooks/use-debounce"
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog"
import { Upload, Download, Search, X, FileSpreadsheet, Loader2, Hash, Trash2, RefreshCw, Languages } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ScriptLine, ScriptLineInput, RecStatus } from "@/lib/types"
import { saveScriptLines, updateScriptLine, getScriptLines, deleteScriptLinesByIds, syncActorsToScriptLines } from "@/lib/actions/script-line-actions"
import { parseExcelFile } from "@/lib/parser/excel-parser"
import { ScriptLinesImportDialog } from "./script-lines-import-dialog"
import type { ExcelParseResult } from "@/lib/parser/excel-parser"
import type { StructuredParseResult } from "@/lib/parser/structured-parser"

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
  const [searchRoleInput, setSearchRoleInput] = useState("")
  const searchRole = useDebounce(searchRoleInput, 300)

  // Bulk selection
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const selectAllCheckboxRef = useRef<HTMLInputElement>(null)

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
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [excelResult, setExcelResult] = useState<ExcelParseResult | null>(null)
  const [structuredData, setStructuredData] = useState<StructuredParseResult[] | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Jump-to-line (Agent 6)
  const [jumpToLine, setJumpToLine] = useState("")
  const tableBodyRef = useRef<HTMLTableSectionElement>(null)
  const tableContainerRef = useRef<HTMLDivElement>(null)

  function handleJumpToLine() {
    const num = parseInt(jumpToLine)
    if (isNaN(num)) return
    const idx = filteredLines.findIndex((l) => l.line_number === num)
    if (idx === -1) {
      toast({ title: "שורה לא נמצאה", description: `שורה מספר ${num} לא קיימת`, variant: "destructive" })
      return
    }
    rowVirtualizer.scrollToIndex(idx, { align: "start", behavior: "smooth" })
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

  // Virtualizer for the lines table
  const rowVirtualizer = useVirtualizer({
    count: filteredLines.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => 52,
    measureElement:
      typeof window !== "undefined"
        ? (el) => el?.getBoundingClientRect().height ?? 52
        : undefined,
    overscan: 10,
  })

  // Selection helpers
  const allFilteredSelected = filteredLines.length > 0 && filteredLines.every((l) => selectedIds.has(l.id))
  const someFilteredSelected = filteredLines.some((l) => selectedIds.has(l.id))

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someFilteredSelected && !allFilteredSelected
    }
  }, [someFilteredSelected, allFilteredSelected])

  function toggleRow(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll() {
    if (allFilteredSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredLines.forEach((l) => next.delete(l.id))
        return next
      })
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev)
        filteredLines.forEach((l) => next.add(l.id))
        return next
      })
    }
  }

  async function handleBulkDelete() {
    const ids = Array.from(selectedIds)
    setIsDeleting(true)
    try {
      const result = await deleteScriptLinesByIds(projectId, ids)
      if (!result.success) throw new Error(result.error)

      setLines((prev) => prev.filter((l) => !selectedIds.has(l.id)))
      setTotal((prev) => prev - ids.length)
      setSelectedIds(new Set())
      setShowDeleteConfirm(false)
      toast({
        title: "נמחקו בהצלחה",
        description: `${result.deletedCount} שורות נמחקו`,
      })
    } catch (err) {
      toast({ title: "שגיאה במחיקה", description: String(err), variant: "destructive" })
    } finally {
      setIsDeleting(false)
    }
  }

  // File selection — unified handler for Excel, PDF, DOCX, TXT
  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const allFiles = Array.from(e.target.files ?? [])
    e.target.value = ""
    if (allFiles.length === 0) return

    // ── Multiple Excel files: parse all and merge sheets ─────────────────
    const excelFiles = allFiles.filter((f) => /\.(xlsx|xls)$/i.test(f.name))
    if (excelFiles.length > 1) {
      try {
        const results = await Promise.all(excelFiles.map(parseExcelFile))
        const merged = {
          sheets: results.flatMap((r, i) =>
            r.sheets.map((s) => ({
              ...s,
              name: `${excelFiles[i].name.replace(/\.[^.]+$/, "")} — ${s.name}`,
            }))
          ),
          fileName: `${excelFiles.length} קבצי Excel`,
          totalRows: results.reduce((sum, r) => sum + r.totalRows, 0),
        }
        if (merged.sheets.length === 0) {
          toast({ title: "שגיאה", description: "לא נמצאו גיליונות בקבצים", variant: "destructive" })
          return
        }
        setExcelResult(merged)
        setStructuredData(null)
        setShowImportDialog(true)
        return
      } catch (err) {
        toast({ title: "שגיאה בקריאת Excel", description: err instanceof Error ? err.message : "שגיאה לא ידועה", variant: "destructive" })
        return
      }
    }

    const file = allFiles[0]
    const ext = file.name.split(".").pop()?.toLowerCase()

    try {
      // ── Excel files: existing flow ──────────────────────────────────────
      if (ext === "xlsx" || ext === "xls") {
        const result = await parseExcelFile(file)
        if (result.sheets.length === 0) {
          toast({ title: "שגיאה", description: "לא נמצאו גיליונות בקובץ", variant: "destructive" })
          return
        }
        setExcelResult(result)
        setStructuredData(null)
        setShowImportDialog(true)
        return
      }

      // ── PDF files ───────────────────────────────────────────────────────
      if (ext === "pdf") {
        const { extractTablesFromPDF, extractTextFromPDF } = await import("@/lib/parser/text-extractor")
        const tables = await extractTablesFromPDF(file)

        // If tables with enough rows found, use the column-mapping dialog
        if (tables.length > 0 && tables.some((t) => t.rows.length >= 3)) {
          setStructuredData(tables)
          setExcelResult(null)
          setShowImportDialog(true)
          return
        }

        // Fallback: extract plain text and try dialogue extraction
        const text = await extractTextFromPDF(file)
        if (text.trim().length < 50) {
          toast({ title: "שגיאה", description: "לא חולץ טקסט מספיק מה-PDF. ייתכן שהקובץ סרוק או מבוסס תמונה.", variant: "destructive" })
          return
        }
        const { extractDialogueLines } = await import("@/lib/parser/structured-parser")
        const dialogueLines = extractDialogueLines(text)
        if (dialogueLines.length > 0) {
          await handleImport(dialogueLines)
        } else {
          toast({ title: "שגיאה", description: "לא נמצאו שורות דיאלוג בקובץ ה-PDF", variant: "destructive" })
        }
        return
      }

      // ── DOCX files ──────────────────────────────────────────────────────
      if (ext === "docx") {
        const { extractTablesFromDOCX, extractTextFromDOCX } = await import("@/lib/parser/text-extractor")
        const tables = await extractTablesFromDOCX(file)

        if (tables.length > 0 && tables.some((t) => t.rows.length >= 3)) {
          setStructuredData(tables)
          setExcelResult(null)
          setShowImportDialog(true)
          return
        }

        // Fallback: extract plain text and try dialogue extraction
        const text = await extractTextFromDOCX(file)
        if (text.trim().length < 50) {
          toast({ title: "שגיאה", description: "לא חולץ טקסט מספיק מה-DOCX", variant: "destructive" })
          return
        }
        const { extractDialogueLines } = await import("@/lib/parser/structured-parser")
        const dialogueLines = extractDialogueLines(text)
        if (dialogueLines.length > 0) {
          await handleImport(dialogueLines)
        } else {
          toast({ title: "שגיאה", description: "לא נמצאו שורות דיאלוג בקובץ ה-DOCX", variant: "destructive" })
        }
        return
      }

      // ── TXT files ───────────────────────────────────────────────────────
      if (ext === "txt") {
        const text = await file.text()
        if (text.trim().length < 10) {
          toast({ title: "שגיאה", description: "הקובץ ריק או לא מכיל טקסט מספיק", variant: "destructive" })
          return
        }
        const { extractDialogueLines } = await import("@/lib/parser/structured-parser")
        const dialogueLines = extractDialogueLines(text)
        if (dialogueLines.length > 0) {
          await handleImport(dialogueLines)
        } else {
          toast({ title: "שגיאה", description: "לא נמצאו שורות דיאלוג בקובץ הטקסט. ודא שהפורמט הוא NAME: dialogue או NAME ואחריו שורה מוזחת.", variant: "destructive" })
        }
        return
      }

      toast({ title: "שגיאה", description: `פורמט קובץ .${ext} אינו נתמך`, variant: "destructive" })
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

        // Auto-sync actors from existing castings
        const syncResult = await syncActorsToScriptLines(projectId)

        const { lines: freshLines, total: freshTotal } = await getScriptLines(projectId, {}, { from: 0, to: PAGE_SIZE - 1 })
        setLines(freshLines)
        setTotal(freshTotal)

        const syncNote = syncResult.success && syncResult.synced > 0
          ? ` (${syncResult.synced} שורות שובצו אוטומטית)`
          : ""
        toast({
          title: "ייבוא הצליח",
          description: `${result.linesCreated} שורות יובאו לסביבת העבודה${syncNote}`,
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

  // Sync actors from castings to script lines
  const handleSyncActors = useCallback(
    async () => {
      setIsSyncing(true)
      try {
        const result = await syncActorsToScriptLines(projectId)
        if (!result.success) throw new Error(result.error)

        // Refresh lines to show updated actor assignments
        const { lines: freshLines, total: freshTotal } = await getScriptLines(projectId, {}, { from: 0, to: PAGE_SIZE - 1 })
        setLines(freshLines)
        setTotal(freshTotal)

        toast({
          title: "סנכרון הושלם",
          description: `${result.synced} שורות עודכנו, ${result.cleared} שורות נוקו`,
        })
      } catch (err) {
        console.error(err)
        toast({ title: "שגיאת סנכרון", description: String(err), variant: "destructive" })
      } finally {
        setIsSyncing(false)
      }
    },
    [projectId, toast]
  )

  // Auto-translate all lines without existing translation
  const handleAutoTranslate = useCallback(
    async () => {
      setIsTranslating(true)
      try {
        const { translateScriptLines } = await import("@/lib/actions/translate-actions")
        const result = await translateScriptLines(projectId)
        if (!result.success) throw new Error(result.error)

        if (result.translated === 0) {
          toast({ title: "אין שורות לתרגום", description: "כל השורות כבר מתורגמות" })
        } else {
          // Refresh lines to show translations
          const { lines: freshLines, total: freshTotal } = await getScriptLines(projectId, {}, { from: 0, to: PAGE_SIZE - 1 })
          setLines(freshLines)
          setTotal(freshTotal)
          toast({ title: "תרגום הושלם", description: `${result.translated} שורות תורגמו` })
        }
      } catch (err) {
        console.error(err)
        toast({ title: "שגיאת תרגום", description: String(err), variant: "destructive" })
      } finally {
        setIsTranslating(false)
      }
    },
    [projectId, toast]
  )

  // Inline translation update
  const handleTranslationChange = useCallback(
    async (lineId: string, newTranslation: string) => {
      // Capture original before optimistic update
      let originalTranslation: string | undefined
      setLines((prev) => {
        const line = prev.find((l) => l.id === lineId)
        originalTranslation = line?.translation
        return prev.map((l) =>
          l.id === lineId ? { ...l, translation: newTranslation } : l
        )
      })
      const result = await updateScriptLine(lineId, { translation: newTranslation })
      if (!result.success) {
        toast({ title: "שגיאה", description: "שגיאה בשמירת תרגום", variant: "destructive" })
        // Revert to original
        setLines((prev) =>
          prev.map((l) =>
            l.id === lineId ? { ...l, translation: originalTranslation } : l
          )
        )
      }
    },
    [toast]
  )

  // Inline rec_status update
  const handleRecStatusChange = useCallback(
    async (lineId: string, newStatus: RecStatus | null) => {
      // Capture original before optimistic update
      let originalStatus: RecStatus | null | undefined
      setLines((prev) => {
        const line = prev.find((l) => l.id === lineId)
        originalStatus = line?.rec_status
        return prev.map((l) =>
          l.id === lineId ? { ...l, rec_status: newStatus } : l
        )
      })
      const result = await updateScriptLine(lineId, { rec_status: newStatus })
      if (!result.success) {
        toast({ title: "שגיאה", description: "שגיאה בשמירת סטטוס", variant: "destructive" })
        // Revert to original
        setLines((prev) =>
          prev.map((l) =>
            l.id === lineId ? { ...l, rec_status: originalStatus ?? null } : l
          )
        )
      }
    },
    [toast]
  )

  // Excel export — RTL, bold headers, freeze pane, auto widths, filters (Agent 6)
  async function handleExport() {
    try {
      const XLSX = await import("xlsx")

      const HEADERS = ["#", "TC", "תפקיד", "שחקן", "סטטוס הקלטה", "תרגום", "טקסט מקור", "הערות"]

      // Build rows as arrays (preserves column order)
      const dataRows = lines.map((l) => [
        l.line_number ?? "",
        l.timecode ?? "",
        l.role_name,
        l.actor_name ?? "",
        l.rec_status ?? "",
        l.translation ?? "",
        l.source_text ?? "",
        l.notes ?? "",
      ])

      const allRows = [HEADERS, ...dataRows]
      const ws = XLSX.utils.aoa_to_sheet(allRows)

      // Column widths (characters)
      ws["!cols"] = [
        { wch: 6 },   // #
        { wch: 14 },  // TC
        { wch: 22 },  // תפקיד
        { wch: 18 },  // שחקן
        { wch: 14 },  // סטטוס
        { wch: 40 },  // תרגום
        { wch: 40 },  // טקסט מקור
        { wch: 24 },  // הערות
      ]

      // Freeze first row (header)
      ws["!freeze"] = { xSplit: 0, ySplit: 1 }

      // AutoFilter on header row
      const lastCol = String.fromCharCode(65 + HEADERS.length - 1) // 'H'
      ws["!autofilter"] = { ref: `A1:${lastCol}1` }

      // Bold header row + RTL alignment for all cells
      const boldStyle = { font: { bold: true }, alignment: { horizontal: "right", readingOrder: 2 } }
      const cellStyle = { alignment: { horizontal: "right", readingOrder: 2, wrapText: true } }

      for (let c = 0; c < HEADERS.length; c++) {
        const headerAddr = XLSX.utils.encode_cell({ r: 0, c })
        if (!ws[headerAddr]) ws[headerAddr] = { v: HEADERS[c], t: "s" }
        ws[headerAddr].s = boldStyle
      }
      for (let r = 1; r <= dataRows.length; r++) {
        for (let c = 0; c < HEADERS.length; c++) {
          const addr = XLSX.utils.encode_cell({ r, c })
          if (ws[addr]) ws[addr].s = cellStyle
        }
      }

      const wb = XLSX.utils.book_new()
      // RTL sheet direction
      XLSX.utils.book_append_sheet(wb, ws, "סביבת עבודה")
      wb.Workbook = wb.Workbook ?? { Views: [], Sheets: [] }
      wb.Workbook.Sheets = wb.Workbook.Sheets ?? []
      wb.Workbook.Sheets[0] = wb.Workbook.Sheets[0] ?? {};
      (wb.Workbook.Sheets[0] as Record<string, unknown>).RTL = true

      XLSX.writeFile(wb, `workspace-${projectId}.xlsx`)
      toast({ title: "ייצוא הצליח", description: `${lines.length.toLocaleString()} שורות יוצאו` })
    } catch {
      toast({ title: "שגיאה בייצוא", variant: "destructive" })
    }
  }

  const hasLines = lines.length > 0

  return (
    <div className="space-y-4 w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap" dir="rtl">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.pdf,.docx,.txt" multiple className="hidden" onChange={handleFileSelect} />
        <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} className="gap-1.5">
          <Upload className="h-4 w-4" />
          {"ייבא קובץ"}
        </Button>

        {hasLines && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            {"ייצא Excel"}
          </Button>
        )}

        {hasLines && (
          <Button variant="outline" size="sm" onClick={handleSyncActors} disabled={isSyncing} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "מסנכרן..." : "סנכרן שחקנים"}
          </Button>
        )}

        {hasLines && (
          <Button variant="outline" size="sm" onClick={handleAutoTranslate} disabled={isTranslating} className="gap-1.5">
            <Languages className="h-4 w-4" />
            {isTranslating ? "מתרגם..." : "תרגם לעברית"}
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

      {/* Bulk action bar — shown when rows are selected */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-3 px-3 py-2 bg-muted/60 rounded-lg border" dir="rtl">
          <span className="text-sm font-medium">{selectedIds.size.toLocaleString()} שורות נבחרו</span>
          <Button
            variant="destructive"
            size="sm"
            className="gap-1.5 mr-auto"
            onClick={() => setShowDeleteConfirm(true)}
          >
            <Trash2 className="h-4 w-4" />
            {"מחיקה"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setSelectedIds(new Set())}
            className="text-muted-foreground"
          >
            {"ביטול בחירה"}
          </Button>
        </div>
      )}

      {/* Filters (Agent 5: combobox for role; Agent 6: jump-to-line) */}
      {!loading && hasLines && (
        <div className="flex items-center gap-2 flex-wrap" dir="rtl">
          {/* Search text */}
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="חיפוש..."
              value={searchRoleInput}
              onChange={(e) => setSearchRoleInput(e.target.value)}
              className="pr-7 h-8 text-sm w-44"
              dir="rtl"
            />
            {searchRoleInput && (
              <button onClick={() => setSearchRoleInput("")} className="absolute left-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
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
          {(filterRole !== "__all__" || filterStatus !== "__all__" || searchRoleInput) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setFilterRole("__all__")
                setFilterStatus("__all__")
                setSearchRoleInput("")
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
          <p className="text-sm text-muted-foreground">{"ייבא קובץ תסריט (Excel, PDF, DOCX או TXT) כדי להתחיל"}</p>
          <Button onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 ml-2" />
            {"ייבא קובץ"}
          </Button>
        </div>
      )}

      {/* Lines table — virtualized with @tanstack/react-virtual */}
      {!loading && hasLines && (
        <div
          ref={tableContainerRef}
          className="border rounded-lg overflow-auto max-h-[calc(100vh-280px)] w-full"
          dir="rtl"
        >
          <Table
            className="w-full"
            style={{ direction: "rtl", tableLayout: "fixed", minWidth: 900 }}
          >
            {/* Fixed column widths — required for table-layout: fixed with virtual rows */}
            <colgroup>
              <col style={{ width: 48 }} />   {/* # */}
              <col style={{ width: 40 }} />   {/* checkbox */}
              <col style={{ width: 96 }} />   {/* TC */}
              <col style={{ width: 132 }} />  {/* role */}
              <col style={{ width: 112 }} />  {/* actor */}
              <col style={{ width: 116 }} />  {/* status */}
              <col />                          {/* translation — fill */}
              <col />                          {/* source — fill */}
            </colgroup>
            <TableHeader className="sticky top-0 bg-background z-10">
              <TableRow>
                <TableHead className="text-right">{"#"}</TableHead>
                <TableHead className="text-center">
                  <input
                    ref={selectAllCheckboxRef}
                    type="checkbox"
                    checked={allFilteredSelected}
                    onChange={toggleAll}
                    className="cursor-pointer accent-primary h-4 w-4"
                    aria-label="בחר הכל"
                  />
                </TableHead>
                <TableHead className="text-right">{"TC"}</TableHead>
                <TableHead className="text-right">{"תפקיד"}</TableHead>
                <TableHead className="text-right">{"שחקן"}</TableHead>
                <TableHead className="text-right">{"סטטוס"}</TableHead>
                <TableHead className="text-right">{"תרגום"}</TableHead>
                <TableHead className="text-right" dir="ltr">{"טקסט מקור"}</TableHead>
              </TableRow>
            </TableHeader>
            {/* Virtual body: position relative + explicit height so virtualizer can position rows */}
            <TableBody
              ref={tableBodyRef}
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const line = filteredLines[virtualRow.index]
                return (
                  <TableRow
                    key={line.id}
                    data-index={virtualRow.index}
                    ref={rowVirtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      transform: `translateY(${virtualRow.start}px)`,
                    }}
                    className={`hover:bg-muted/30 ${selectedIds.has(line.id) ? "bg-primary/5" : ""}`}
                  >
                    <TableCell className="text-right text-xs text-muted-foreground">
                      {line.line_number ?? ""}
                    </TableCell>
                    <TableCell className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(line.id)}
                        onChange={() => toggleRow(line.id)}
                        className="cursor-pointer accent-primary h-4 w-4"
                        aria-label={`בחר שורה ${line.line_number ?? ""}`}
                      />
                    </TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground text-right">
                      {line.timecode ?? "\u2014"}
                    </TableCell>
                    <TableCell>
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={`text-xs max-w-full truncate block cursor-pointer hover:opacity-75 transition-opacity ${getRoleColor(line.role_name, roleIndex)}`}
                              onClick={() => setFilterRole(filterRole === line.role_name ? "__all__" : line.role_name)}
                              title={filterRole === line.role_name ? "בטל סינון" : `סנן לפי ${line.role_name}`}
                            >
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
                      <Select
                        value={line.rec_status ?? "__pending__"}
                        onValueChange={(v) =>
                          handleRecStatusChange(
                            line.id,
                            v === "__pending__" ? null : (v as RecStatus)
                          )
                        }
                      >
                        <SelectTrigger
                          className={`h-7 w-28 text-xs border-0 shadow-none px-2 ${
                            line.rec_status
                              ? REC_STATUS_CONFIG[line.rec_status].className
                              : "text-muted-foreground"
                          }`}
                          dir="rtl"
                        >
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent dir="rtl">
                          <SelectItem value="__pending__" className="text-xs text-muted-foreground">
                            {"ממתין"}
                          </SelectItem>
                          {REC_STATUS_OPTIONS.map((s) => (
                            <SelectItem key={s.value} value={s.value} className="text-xs">
                              {s.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
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

      {/* Bulk delete confirmation dialog */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent dir="rtl" className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{"מחיקת שורות"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {"האם למחוק את השורות שנבחרו?"}{" "}
            <span className="font-medium text-foreground">({selectedIds.size.toLocaleString()} שורות)</span>
            {" "}{"פעולה זו בלתי הפיכה."}
          </p>
          <DialogFooter className="flex-row-reverse gap-2 sm:justify-start">
            <Button
              variant="outline"
              onClick={() => setShowDeleteConfirm(false)}
              disabled={isDeleting}
            >
              {"ביטול"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkDelete}
              disabled={isDeleting}
              className="gap-1.5"
            >
              {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
              {"מחק"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Import dialog */}
      {(excelResult || structuredData) && (
        <ScriptLinesImportDialog
          open={showImportDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowImportDialog(false)
              setExcelResult(null)
              setStructuredData(null)
            }
          }}
          excelResult={excelResult ?? undefined}
          structuredData={structuredData ?? undefined}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}
    </div>
  )
}
