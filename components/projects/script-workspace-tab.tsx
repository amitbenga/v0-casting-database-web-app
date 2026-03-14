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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { Upload, Download, Search, X, FileSpreadsheet, Loader2, Hash, Trash2, RefreshCw, Languages, Sparkles, ChevronDown, ChevronUp, Plus, MoreHorizontal } from "lucide-react"
import { useToast } from "@/hooks/use-toast"
import type { ScriptLine, ScriptLineInput, RecStatus } from "@/lib/types"
import {
  saveScriptLines,
  updateScriptLine,
  getScriptLines,
  deleteScriptLinesByIds,
  syncActorsToScriptLines,
  addScriptLine,
  insertScriptLineRelative,
  duplicateScriptLine,
  getScriptLineCountsByRole,
} from "@/lib/actions/script-line-actions"
import { parseExcelFile } from "@/lib/parser/excel-parser"
import { ScriptLinesImportDialog } from "./script-lines-import-dialog"
import type { ExcelParseResult } from "@/lib/parser/excel-parser"
import type { StructuredParseResult } from "@/lib/parser/structured-parser"
import { AIModelSelector } from "@/components/ai-model-selector"
import { DEFAULT_TRANSLATE_MODEL, type AIModelId } from "@/lib/ai-config"

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

// Inline translation cell — single-line display, h-8 to match fixed row height
function TranslationCell({
  lineId,
  value,
  onChange,
}: {
  lineId: string
  value: string | undefined
  onChange: (lineId: string, newValue: string) => void
}): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")

  function startEdit() {
    setDraft(value ?? "")
    setEditing(true)
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
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === "Escape") { setEditing(false); setDraft(value ?? "") }
        }}
        className="w-full h-8 p-1 text-sm border rounded resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        dir="rtl"
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      className="cursor-pointer h-8 flex items-center px-1 text-sm hover:bg-muted/50 rounded transition-colors truncate whitespace-nowrap overflow-hidden"
      dir="rtl"
      title={value ?? ""}
    >
      {value
        ? <span className="truncate">{value}</span>
        : <span className="text-muted-foreground italic text-xs">{"לחץ לעריכה..."}</span>
      }
    </div>
  )
}

function SourceTextCell({
  lineId,
  value,
  onChange,
}: {
  lineId: string
  value: string | undefined
  onChange: (lineId: string, newValue: string) => void
}): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")

  function startEdit() {
    setDraft(value ?? "")
    setEditing(true)
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
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); commit() }
          if (e.key === "Escape") { setEditing(false); setDraft(value ?? "") }
        }}
        className="w-full h-8 p-1 text-xs border rounded resize-none bg-background focus:outline-none focus:ring-1 focus:ring-primary"
        dir="ltr"
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      className="cursor-pointer h-8 flex items-center px-1 text-xs hover:bg-muted/50 rounded transition-colors truncate whitespace-nowrap overflow-hidden text-muted-foreground"
      dir="ltr"
      title={value ?? ""}
    >
      {value
        ? <span className="truncate">{value}</span>
        : <span className="text-muted-foreground italic text-xs">{"לחץ לעריכה..."}</span>
      }
    </div>
  )
}

function TimecodeCell({
  lineId,
  value,
  onChange,
}: {
  lineId: string
  value: string | undefined
  onChange: (lineId: string, newValue: string) => void
}): React.ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value ?? "")

  function startEdit() {
    setDraft(value ?? "")
    setEditing(true)
  }

  function commit() {
    setEditing(false)
    if (draft !== (value ?? "")) {
      onChange(lineId, draft.trim())
    }
  }

  if (editing) {
    return (
      <input
        autoFocus
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") { e.preventDefault(); commit() }
          if (e.key === "Escape") { setEditing(false); setDraft(value ?? "") }
        }}
        placeholder="HH:MM:SS:FF"
        className="w-full h-8 px-1 text-xs border rounded bg-background focus:outline-none focus:ring-1 focus:ring-primary font-mono text-center"
        dir="ltr"
      />
    )
  }

  return (
    <div
      onClick={startEdit}
      className="cursor-pointer w-full h-8 flex justify-center items-center px-1 text-xs font-mono text-muted-foreground hover:bg-muted/50 rounded transition-colors"
      title="ערוך טיימקוד"
    >
      {value ? (
        <span>{value}</span>
      ) : (
        <span className="opacity-0 group-hover:opacity-100 transition-opacity">--:--</span>
      )}
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

function RowActionsMenu({
  onInsertAbove,
  onInsertBelow,
  onDuplicate,
}: {
  onInsertAbove: () => Promise<void>
  onInsertBelow: () => Promise<void>
  onDuplicate: () => Promise<void>
}): React.ReactElement {
  return (
    <DropdownMenu dir="rtl">
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-foreground"
          onClick={(e) => e.stopPropagation()}
        >
          <MoreHorizontal className="h-4 w-4" />
          <span className="sr-only">{"פעולות שורה"}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start">
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void onInsertAbove() }}>
          {"הוסף שורה מעל"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void onInsertBelow() }}>
          {"הוסף שורה מתחת"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={(e) => { e.preventDefault(); void onDuplicate() }}>
          {"שכפל שורה"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
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

  // Actor progress panel
  const [progressOpen, setProgressOpen] = useState(false)
  const [selectedProgressActor, setSelectedProgressActor] = useState<string | null>(null)

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

  // Replica count per role — fetched from DB so it's correct regardless of pagination
  const [replicaCounts, setReplicaCounts] = useState<Map<string, number>>(new Map())

  const refreshReplicaCounts = useCallback(async () => {
    const counts = await getScriptLineCountsByRole(projectId)
    setReplicaCounts(new Map(Object.entries(counts)))
  }, [projectId])

  useEffect(() => {
    refreshReplicaCounts()
  }, [refreshReplicaCounts])

  const refreshVisibleLines = useCallback(
    async (targetCount = lines.length) => {
      const countToLoad = Math.max(targetCount, PAGE_SIZE)
      const [{ lines: freshLines, total: freshTotal }] = await Promise.all([
        getScriptLines(projectId, {}, { from: 0, to: countToLoad - 1 }),
        refreshReplicaCounts(),
      ])
      setLines(freshLines)
      setTotal(freshTotal)
    },
    [projectId, lines.length, refreshReplicaCounts]
  )

  const [filterRole, setFilterRole] = useState<string>("__all__")
  const [filterStatus, setFilterStatus] = useState<string>("__all__")
  const [isImporting, setIsImporting] = useState(false)
  const [isSyncing, setIsSyncing] = useState(false)
  const [isTranslating, setIsTranslating] = useState(false)
  const [aiTranslateModel, setAiTranslateModel] = useState<AIModelId>(DEFAULT_TRANSLATE_MODEL)
  const [excelResults, setExcelResults] = useState<ExcelParseResult[] | null>(null)
  const [structuredData, setStructuredData] = useState<StructuredParseResult[] | null>(null)
  const [showImportDialog, setShowImportDialog] = useState(false)
  const [pendingAiFile, setPendingAiFile] = useState<File | null>(null)
  const [isAiParsing, setIsAiParsing] = useState(false)
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
  const ROW_HEIGHT = 44
  const rowVirtualizer = useVirtualizer({
    count: filteredLines.length,
    getScrollElement: () => tableContainerRef.current,
    estimateSize: () => ROW_HEIGHT,
    // No measureElement — fixed row height prevents content from expanding rows
    overscan: 12,
  })

  // Selection helpers
  const allFilteredSelected = filteredLines.length > 0 && filteredLines.every((l) => selectedIds.has(l.id))
  const someFilteredSelected = filteredLines.some((l) => selectedIds.has(l.id))
  const lastSelectedIndexRef = useRef<number>(-1)

  // Reset range anchor when filters change
  useEffect(() => { lastSelectedIndexRef.current = -1 }, [filterRole, filterStatus, searchRole])

  useEffect(() => {
    if (selectAllCheckboxRef.current) {
      selectAllCheckboxRef.current.indeterminate = someFilteredSelected && !allFilteredSelected
    }
  }, [someFilteredSelected, allFilteredSelected])

  function toggleRow(id: string, shiftKey = false) {
    const currentIndex = filteredLines.findIndex((l) => l.id === id)

    if (shiftKey && lastSelectedIndexRef.current >= 0 && currentIndex >= 0) {
      // Range selection: select all rows between last click and current click
      const start = Math.min(lastSelectedIndexRef.current, currentIndex)
      const end = Math.max(lastSelectedIndexRef.current, currentIndex)
      setSelectedIds((prev) => {
        const next = new Set(prev)
        for (let i = start; i <= end; i++) {
          next.add(filteredLines[i].id)
        }
        return next
      })
    } else {
      // Single toggle
      setSelectedIds((prev) => {
        const next = new Set(prev)
        if (next.has(id)) next.delete(id)
        else next.add(id)
        return next
      })
    }

    if (currentIndex >= 0) lastSelectedIndexRef.current = currentIndex
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
      refreshReplicaCounts()
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

    // ── Excel files: parse each separately, pass as array to dialog (per-file tabs) ─
    const excelFiles = allFiles.filter((f) => /\.(xlsx|xls)$/i.test(f.name))
    if (excelFiles.length > 0) {
      try {
        const results = await Promise.all(excelFiles.map(parseExcelFile))
        if (results.every((r) => r.sheets.length === 0)) {
          toast({ title: "שגיאה", description: "לא נמצאו גיליונות בקבצים", variant: "destructive" })
          return
        }
        setExcelResults(results)
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

      // ── PDF files ───────────────────────────────────────────────────────
      if (ext === "pdf") {
        const {
          extractTablesFromPDF,
          extractTextFromPDF,
          extractTextFromPDFRaw,
        } = await import("@/lib/parser/text-extractor")
        const { autoDetectColumns, parseScriptLinesFromStructuredData, extractDialogueLines } =
          await import("@/lib/parser/structured-parser")

        // 1. Try table extraction → auto-import directly (no dialog for non-Excel)
        const tables = await extractTablesFromPDF(file)
        if (tables.length > 0 && tables.some((t) => t.rows.length >= 3)) {
          const allLines = tables.flatMap((table) => {
            const mapping = autoDetectColumns(table.headers)
            if (!mapping.roleNameColumn) return []
            return parseScriptLinesFromStructuredData(table, {
              ...mapping,
              roleNameColumn: mapping.roleNameColumn,
            })
          })
          if (allLines.length > 0) {
            await handleImport(allLines)
            return
          }
        }

        // 2. Fallback: extract plain text → dialogue lines
        let text = ""
        try {
          text = await extractTextFromPDF(file)
        } catch {
          // PDF.js failed — try raw binary extraction
          try { text = await extractTextFromPDFRaw(file) } catch { /* ignore */ }
        }
        // If PDF.js returned empty but no exception, also try raw
        if (text.trim().length < 50) {
          try { text = await extractTextFromPDFRaw(file) } catch { /* ignore */ }
        }

        if (text.trim().length < 50) {
          setPendingAiFile(file)
          toast({
            title: "לא הצלחנו לחלץ טקסט מה-PDF",
            description: "הקובץ ייתכן שהוא סרוק. לחץ על \"עיבוד עם AI\" בסרגל.",
          })
          return
        }
        const dialogueLines = extractDialogueLines(text)
        if (dialogueLines.length > 0) {
          await handleImport(dialogueLines)
        } else {
          setPendingAiFile(file)
          toast({
            title: "לא נמצאו שורות דיאלוג ב-PDF",
            description: "המבנה לא מוכר לעיבוד. לחץ על \"עיבוד עם AI\" בסרגל.",
          })
        }
        return
      }

      // ── DOCX files ──────────────────────────────────────────────────────
      if (ext === "docx") {
        const { extractTablesFromDOCX, extractTextFromDOCX } = await import("@/lib/parser/text-extractor")
        const { autoDetectColumns, parseScriptLinesFromStructuredData, extractDialogueLines } =
          await import("@/lib/parser/structured-parser")

        // 1. Try table extraction → auto-import
        const tables = await extractTablesFromDOCX(file)
        if (tables.length > 0 && tables.some((t) => t.rows.length >= 3)) {
          const allLines = tables.flatMap((table) => {
            const mapping = autoDetectColumns(table.headers)
            if (!mapping.roleNameColumn) return []
            return parseScriptLinesFromStructuredData(table, {
              ...mapping,
              roleNameColumn: mapping.roleNameColumn,
            })
          })
          if (allLines.length > 0) {
            await handleImport(allLines)
            return
          }
        }

        // 2. Fallback: plain text → dialogue lines
        const text = await extractTextFromDOCX(file)
        if (text.trim().length < 50) {
          setPendingAiFile(file)
          toast({ title: "לא ניתן לחלץ טקסט מה-DOCX", description: "לחץ על \"עיבוד עם AI\" בסרגל." })
          return
        }
        const dialogueLines = extractDialogueLines(text)
        if (dialogueLines.length > 0) {
          await handleImport(dialogueLines)
        } else {
          setPendingAiFile(file)
          toast({ title: "לא נמצאו שורות דיאלוג ב-DOCX", description: "לחץ על \"עיבוד עם AI\" בסרגל." })
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
        setExcelResults(null)

        // Auto-sync actors from existing castings
        const syncResult = await syncActorsToScriptLines(projectId)

        const [{ lines: freshLines, total: freshTotal }] = await Promise.all([
          getScriptLines(projectId, {}, { from: 0, to: PAGE_SIZE - 1 }),
          refreshReplicaCounts(),
        ])
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
    [projectId, toast, refreshReplicaCounts]
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
        const result = await translateScriptLines(projectId, { model: aiTranslateModel })
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
    [projectId, toast, aiTranslateModel]
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

  // Inline source text update
  const handleSourceTextChange = useCallback(
    async (lineId: string, newSourceText: string) => {
      // Capture original before optimistic update
      let originalSourceText: string | undefined
      setLines((prev) => {
        const line = prev.find((l) => l.id === lineId)
        originalSourceText = line?.source_text
        return prev.map((l) =>
          l.id === lineId ? { ...l, source_text: newSourceText } : l
        )
      })
      const result = await updateScriptLine(lineId, { source_text: newSourceText })
      if (!result.success) {
        toast({ title: "שגיאה", description: "שגיאה בשמירת טקסט מקור", variant: "destructive" })
        // Revert to original
        setLines((prev) =>
          prev.map((l) =>
            l.id === lineId ? { ...l, source_text: originalSourceText } : l
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

  // Inline timecode update
  const handleTimecodeChange = useCallback(
    async (lineId: string, newTimecode: string) => {
      // Capture original before optimistic update
      let originalTimecode: string | undefined
      setLines((prev) => {
        const line = prev.find((l) => l.id === lineId)
        originalTimecode = line?.timecode
        return prev.map((l) =>
          l.id === lineId ? { ...l, timecode: newTimecode } : l
        )
      })
      const result = await updateScriptLine(lineId, { timecode: newTimecode })
      if (!result.success) {
        toast({ title: "שגיאה", description: "שגיאה בשמירת טיימקוד", variant: "destructive" })
        // Revert to original
        setLines((prev) =>
          prev.map((l) =>
            l.id === lineId ? { ...l, timecode: originalTimecode } : l
          )
        )
      }
    },
    [toast]
  )

  const handleAddLineAtEnd = useCallback(
    async () => {
      const newLine: ScriptLineInput = {
        line_number: 0,
        role_name: "דמות חדשה",
        source_text: "",
        translation: "",
        rec_status: null,
      }
      const result = await addScriptLine(projectId, newLine)
      if (result.success && result.line) {
        if (hasMore) {
          await refreshVisibleLines(lines.length)
          toast({
            title: "שורה נוספה",
            description: `שורה #${result.line.line_number} נוספה לסוף הפרויקט. טען עוד כדי לראות אותה.`,
          })
        } else {
          await refreshVisibleLines(lines.length + 1)
          toast({ title: "שורה נוספה", description: `שורה #${result.line.line_number} נוספה ומוכנה לעריכה.` })
        }
      } else {
        toast({ title: "שגיאה בהוספת שורה", description: result.error, variant: "destructive" })
      }
    },
    [projectId, toast, refreshVisibleLines, hasMore, lines.length]
  )

  const handleInsertRelativeLine = useCallback(
    async (referenceLineId: string, position: "above" | "below") => {
      const result = await insertScriptLineRelative(projectId, referenceLineId, position)
      if (result.success && result.line) {
        await refreshVisibleLines(lines.length + 1)
        toast({
          title: "שורה נוספה",
          description: position === "above"
            ? "שורה חדשה נוספה מעל השורה שנבחרה."
            : "שורה חדשה נוספה מתחת לשורה שנבחרה.",
        })
      } else {
        toast({ title: "שגיאה בהוספת שורה", description: result.error, variant: "destructive" })
      }
    },
    [projectId, toast, refreshVisibleLines, lines.length]
  )

  const handleDuplicateLine = useCallback(
    async (lineId: string) => {
      const result = await duplicateScriptLine(projectId, lineId)
      if (result.success && result.line) {
        await refreshVisibleLines(lines.length + 1)
        toast({ title: "שורה שוכפלה", description: `שורה #${result.line.line_number} נוצרה כהעתק לעריכה.` })
      } else {
        toast({ title: "שגיאה בשכפול שורה", description: result.error, variant: "destructive" })
      }
    },
    [projectId, toast, refreshVisibleLines, lines.length]
  )

  // Master Excel export — RTL, bold headers, multiple sheets (Agent 6)
  async function handleExport() {
    try {
      const XLSX = await import("xlsx")
      const { getProjectRolesWithCasting } = await import("@/lib/actions/casting-actions")

      const { roles, success } = await getProjectRolesWithCasting(projectId)
      const rolesData = success && roles ? roles : []

      // ---------------------------------------------------------
      // Sheet 1: Script Workspace (סביבת עבודה)
      // ---------------------------------------------------------
      const HEADERS = ["#", "TC", "תפקיד", "שחקן", "סטטוס הקלטה", "תרגום", "טקסט מקור", "הערות"]

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

      ws["!freeze"] = { xSplit: 0, ySplit: 1 }
      const lastCol = String.fromCharCode(65 + HEADERS.length - 1)
      ws["!autofilter"] = { ref: `A1:${lastCol}1` }

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

      // ---------------------------------------------------------
      // Sheet 2: Roles and Castings (צוות ותפקידים)
      // ---------------------------------------------------------
      const CASTING_HEADERS = ["תפקיד", "כמות רפליקות", "סטטוס ליהוק", "שחקן מלוהק", "סטטוס מס הכנסה", "הערות הקלטה"]

      const castingRows = rolesData.map(r => {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const mainCasting: any = Array.isArray(r.castings) ? r.castings.find((c: any) => c.status === "מלוהק") || r.castings[0] : r.casting;

        return [
          r.role_name,
          r.replicas_count || r.replicas_needed || 0,
          mainCasting?.status || "לא מלוהק",
          mainCasting?.name || "",
          // Only if VAT exists on actor (it doesn't in the summarized role view natively without extra query, we will gracefully fallback to "")
          "",
          mainCasting?.notes || ""
        ]
      })

      const castingWs = XLSX.utils.aoa_to_sheet([CASTING_HEADERS, ...castingRows])
      castingWs["!cols"] = [
        { wch: 22 },  // תפקיד
        { wch: 15 },  // כמות
        { wch: 15 },  // סטטוס
        { wch: 25 },  // שחקן
        { wch: 15 },  // VAT (Empty initially)
        { wch: 40 },  // הערות
      ]

      castingWs["!freeze"] = { xSplit: 0, ySplit: 1 }
      const cLastCol = String.fromCharCode(65 + CASTING_HEADERS.length - 1)
      castingWs["!autofilter"] = { ref: `A1:${cLastCol}1` }

      for (let c = 0; c < CASTING_HEADERS.length; c++) {
        const headerAddr = XLSX.utils.encode_cell({ r: 0, c })
        if (!castingWs[headerAddr]) castingWs[headerAddr] = { v: CASTING_HEADERS[c], t: "s" }
        castingWs[headerAddr].s = boldStyle
      }
      for (let r = 1; r <= castingRows.length; r++) {
        for (let c = 0; c < CASTING_HEADERS.length; c++) {
          const addr = XLSX.utils.encode_cell({ r, c })
          if (castingWs[addr]) castingWs[addr].s = cellStyle
        }
      }

      // ---------------------------------------------------------
      // Produce workbook
      // ---------------------------------------------------------
      const wb = XLSX.utils.book_new()
      XLSX.utils.book_append_sheet(wb, ws, "סביבת עבודה")
      XLSX.utils.book_append_sheet(wb, castingWs, "צוות ותפקידים")

      wb.Workbook = wb.Workbook ?? { Views: [], Sheets: [] }
      wb.Workbook.Sheets = wb.Workbook.Sheets ?? []
      if (!wb.Workbook.Sheets[0]) wb.Workbook.Sheets[0] = {}
      if (!wb.Workbook.Sheets[1]) wb.Workbook.Sheets[1] = {}
        ; (wb.Workbook.Sheets[0] as Record<string, unknown>).RTL = true
        ; (wb.Workbook.Sheets[1] as Record<string, unknown>).RTL = true

      XLSX.writeFile(wb, `Master-Project-${projectId}.xlsx`)
      toast({ title: "ייצוא פרוייקט שלם הצליח", description: `${lines.length.toLocaleString()} שורות ו-${rolesData.length} תפקידים מלוהקים יוצאו לקובץ Excel מרוכז.` })
    } catch {
      toast({ title: "שגיאה בייצוא", variant: "destructive" })
    }
  }

  // AI parsing fallback — called when PDF/DOCX extraction fails
  async function handleAiParse() {
    if (!pendingAiFile) return
    setIsAiParsing(true)
    try {
      // Read file as base64 to pass to server action
      const arrayBuffer = await pendingAiFile.arrayBuffer()
      const base64 = btoa(String.fromCharCode(...new Uint8Array(arrayBuffer)))
      const { parseScriptWithAI } = await import("@/lib/actions/ai-parse-action")
      const result = await parseScriptWithAI({
        fileBase64: base64,
        fileName: pendingAiFile.name,
        mimeType: pendingAiFile.type || "application/pdf",
      })
      if (!result.success || !result.lines?.length) {
        toast({
          title: "עיבוד AI לא מצא שורות",
          description: result.error ?? "נסה קובץ אחר או הכנס את הנתונים ידנית",
          variant: "destructive",
        })
        return
      }
      await handleImport(result.lines)
      setPendingAiFile(null)
    } catch (err) {
      toast({
        title: "שגיאה בעיבוד AI",
        description: err instanceof Error ? err.message : "שגיאה לא ידועה",
        variant: "destructive",
      })
    } finally {
      setIsAiParsing(false)
    }
  }

  const hasLines = lines.length > 0

  return (
    <div className="space-y-4 w-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 flex-wrap" dir="rtl">
        <input ref={fileInputRef} type="file" accept=".xlsx,.xls,.pdf,.docx,.txt" multiple className="hidden" onChange={handleFileSelect} />

        {hasLines && (
          <Button variant="outline" size="sm" onClick={handleExport} className="gap-1.5">
            <Download className="h-4 w-4" />
            {"ייצא Excel"}
          </Button>
        )}

        <Button variant="outline" size="sm" onClick={handleAddLineAtEnd} className="gap-1.5">
          <Plus className="h-4 w-4" />
          {"הוסף שורה חדשה"}
        </Button>

        {hasLines && (
          <Button variant="outline" size="sm" onClick={handleSyncActors} disabled={isSyncing} className="gap-1.5">
            <RefreshCw className={`h-4 w-4 ${isSyncing ? "animate-spin" : ""}`} />
            {isSyncing ? "מסנכרן..." : "סנכרן שחקנים"}
          </Button>
        )}

        {hasLines && (
          <>
            <Button variant="outline" size="sm" onClick={handleAutoTranslate} disabled={isTranslating} className="gap-1.5">
              <Languages className="h-4 w-4" />
              {isTranslating ? "מתרגם..." : "תרגם לעברית"}
            </Button>
            <AIModelSelector value={aiTranslateModel} onChange={setAiTranslateModel} disabled={isTranslating} />
          </>
        )}

        {pendingAiFile && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleAiParse}
            disabled={isAiParsing}
            className="gap-1.5 text-purple-700 border-purple-300 hover:bg-purple-50 dark:text-purple-400 dark:border-purple-700"
          >
            <Sparkles className={`h-4 w-4 ${isAiParsing ? "animate-pulse" : ""}`} />
            {isAiParsing ? "מעבד..." : `עיבוד עם AI — ${pendingAiFile.name}`}
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

      {/* Actor recording progress — collapsible */}
      {!loading && hasLines && (() => {
        const actorMap = new Map<string, { name: string; total: number; recorded: number }>()
        for (const line of lines) {
          if (!line.actor_name) continue
          if (!actorMap.has(line.actor_name)) actorMap.set(line.actor_name, { name: line.actor_name, total: 0, recorded: 0 })
          const entry = actorMap.get(line.actor_name)!
          entry.total++
          if (line.rec_status === "הוקלט") entry.recorded++
        }
        const actors = Array.from(actorMap.values()).sort((a, b) => b.total - a.total)
        if (actors.length === 0) return null

        const activeActor = selectedProgressActor
          ? actors.find((a) => a.name === selectedProgressActor) ?? actors[0]
          : null

        return (
          <div className="rounded-lg border bg-muted/20" dir="rtl">
            {/* Header — always visible */}
            <button
              type="button"
              onClick={() => setProgressOpen((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-2.5 text-sm font-medium hover:bg-muted/30 transition-colors rounded-lg"
            >
              <span>התקדמות הקלטה לפי שחקן</span>
              {progressOpen ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {/* Expandable body */}
            {progressOpen && (
              <div className="px-4 pb-4 space-y-3 border-t">
                {/* Actor selector pills */}
                <div className="flex flex-wrap gap-1.5 pt-3">
                  {actors.map((a) => {
                    const pct = a.total > 0 ? Math.round((a.recorded / a.total) * 100) : 0
                    const isSelected = selectedProgressActor === a.name
                    return (
                      <button
                        key={a.name}
                        type="button"
                        onClick={() => setSelectedProgressActor(isSelected ? null : a.name)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border transition-colors ${isSelected
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-muted hover:bg-muted/50"
                          }`}
                      >
                        <span>{a.name}</span>
                        <span className={`${isSelected ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                          {pct}%
                        </span>
                      </button>
                    )
                  })}
                </div>

                {/* Detail view for selected actor */}
                {activeActor ? (() => {
                  const pct = activeActor.total > 0 ? Math.round((activeActor.recorded / activeActor.total) * 100) : 0
                  const isComplete = pct === 100
                  return (
                    <div className="space-y-2 p-3 rounded-lg bg-background border">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-sm">{activeActor.name}</span>
                        <span className={`text-sm font-bold px-2 py-0.5 rounded ${isComplete ? "bg-green-500/15 text-green-700 dark:text-green-300" : "bg-amber-500/15 text-amber-700 dark:text-amber-300"
                          }`}>{pct}%</span>
                      </div>
                      <div className="text-xs text-muted-foreground">{activeActor.recorded} הוקלטו מתוך {activeActor.total} שורות</div>
                      <div className="h-2.5 w-full rounded-full bg-muted overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isComplete ? "bg-green-500" : "bg-amber-400"}`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  )
                })() : (
                  <p className="text-xs text-muted-foreground pb-1">בחר שחקן מעל כדי לראות פירוט</p>
                )}
              </div>
            )}
          </div>
        )
      })()}

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
          <p className="text-sm text-muted-foreground">
            {"כדי להתחיל, העלה תסריט בכרטיסיית "}
            <span className="font-medium text-foreground">{"תסריטים"}</span>
            {" — השורות יופיעו כאן אוטומטית"}
          </p>
        </div>
      )}

      {/* Lines table — virtualized with @tanstack/react-virtual */}
      {!loading && hasLines && (
        <div
          ref={tableContainerRef}
          className="border rounded-lg overflow-auto max-h-[calc(100vh-180px)] w-full"
          dir="rtl"
        >
          {/*
            Grid-based virtual table — header + body share the same grid-template-columns
            so columns always align even with absolutely-positioned virtual rows.
            Fixed cols: 38+34+34+90+140+120+110 = 566px. Remaining space split 50/50 for translation + source.
          */}
          <div style={{ minWidth: 1140, direction: "rtl" }}>
            {/* Header */}
            <div
              className="sticky top-0 bg-background z-10 border-b"
              style={{
                display: "grid",
                gridTemplateColumns: "38px 34px 34px 90px 140px 120px 110px 1fr 1fr",
                minWidth: 1140,
              }}
            >
              <div className="text-right text-xs px-2 font-medium h-10 flex items-center text-foreground">#</div>
              <div className="px-1 text-center h-10 flex items-center justify-center">
                <input
                  ref={selectAllCheckboxRef}
                  type="checkbox"
                  checked={allFilteredSelected}
                  onChange={toggleAll}
                  className="cursor-pointer accent-primary h-4 w-4"
                  aria-label="בחר הכל"
                />
              </div>
              <div className="px-1 h-10 flex items-center justify-center" />
              <div className="text-right text-xs px-2 font-medium h-10 flex items-center text-foreground">TC</div>
              <div className="text-right text-xs px-2 font-medium h-10 flex items-center text-foreground">תפקיד</div>
              <div className="text-right text-xs px-2 font-medium h-10 flex items-center text-foreground">שחקן</div>
              <div className="text-right text-xs px-2 font-medium h-10 flex items-center text-foreground">סטטוס</div>
              <div className="text-right text-xs px-2 font-medium h-10 flex items-center text-foreground">תרגום</div>
              <div className="text-right text-xs px-2 font-medium h-10 flex items-center text-foreground" dir="ltr">טקסט מקור</div>
            </div>
            {/* Virtual body */}
            <div
              ref={tableBodyRef}
              style={{
                height: `${rowVirtualizer.getTotalSize()}px`,
                position: "relative",
              }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                const line = filteredLines[virtualRow.index]
                return (
                  <div
                    key={line.id}
                    data-index={virtualRow.index}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: ROW_HEIGHT,
                      overflow: "hidden",
                      transform: `translateY(${virtualRow.start}px)`,
                      display: "grid",
                      gridTemplateColumns: "38px 34px 34px 90px 140px 120px 110px 1fr 1fr",
                    }}
                    className={`hover:bg-muted/30 border-b ${selectedIds.has(line.id) ? "bg-primary/5" : ""}`}
                  >
                    {/* # */}
                    <div className="text-right text-xs text-muted-foreground px-2 overflow-hidden whitespace-nowrap flex items-center">
                      {line.line_number ?? ""}
                    </div>
                    {/* checkbox */}
                    <div className="text-center px-1 flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(line.id)}
                        onChange={() => {/* handled by onClick for shift-key support */ }}
                        onClick={(e) => toggleRow(line.id, e.shiftKey)}
                        className="cursor-pointer accent-primary h-4 w-4"
                        aria-label={`בחר שורה ${line.line_number ?? ""}`}
                      />
                    </div>
                    {/* row actions */}
                    <div className="px-1 flex items-center justify-center pointer-events-auto z-10">
                      <RowActionsMenu
                        onInsertAbove={() => handleInsertRelativeLine(line.id, "above")}
                        onInsertBelow={() => handleInsertRelativeLine(line.id, "below")}
                        onDuplicate={() => handleDuplicateLine(line.id)}
                      />
                    </div>
                    {/* TC */}
                    <div className="group text-right px-2 overflow-hidden whitespace-nowrap flex items-center min-w-0 pointer-events-auto z-10">
                      <TimecodeCell lineId={line.id} value={line.timecode} onChange={handleTimecodeChange} />
                    </div>
                    {/* Role */}
                    <div className="px-2 overflow-hidden flex items-center">
                      <TooltipProvider delayDuration={300}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Badge
                              variant="secondary"
                              className={`text-xs max-w-full truncate block cursor-pointer hover:opacity-75 transition-opacity ${getRoleColor(line.role_name, roleIndex)}`}
                              onClick={() => setFilterRole(filterRole === line.role_name ? "__all__" : line.role_name)}
                            >
                              {line.role_name}
                            </Badge>
                          </TooltipTrigger>
                          <TooltipContent side="bottom" dir="rtl">{line.role_name}</TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {/* Actor */}
                    <div className="px-2 overflow-hidden whitespace-nowrap flex items-center">
                      {line.actor_name ? (
                        <span className="text-xs font-medium truncate block">{line.actor_name}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </div>
                    {/* Status */}
                    <div className="px-1 overflow-hidden flex items-center">
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
                          className={`h-7 w-full text-xs border-0 shadow-none px-1 ${line.rec_status
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
                    </div>
                    {/* Translation (Hebrew) */}
                    <div className="px-2 overflow-hidden flex items-center min-w-0">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate whitespace-nowrap w-full">
                              <TranslationCell lineId={line.id} value={line.translation} onChange={handleTranslationChange} />
                            </div>
                          </TooltipTrigger>
                          {line.translation && (
                            <TooltipContent side="top" dir="rtl" className="max-w-sm text-xs whitespace-pre-wrap text-right break-words">
                              {line.translation}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                    {/* Source text (English) */}
                    <div className="px-2 overflow-hidden flex items-center min-w-0" dir="ltr">
                      <TooltipProvider delayDuration={200}>
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <div className="truncate whitespace-nowrap w-full">
                              <SourceTextCell lineId={line.id} value={line.source_text} onChange={handleSourceTextChange} />
                            </div>
                          </TooltipTrigger>
                          {line.source_text && (
                            <TooltipContent side="top" dir="ltr" className="max-w-sm text-xs whitespace-pre-wrap text-left break-words">
                              {line.source_text}
                            </TooltipContent>
                          )}
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
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
      {(excelResults || structuredData) && (
        <ScriptLinesImportDialog
          open={showImportDialog}
          onOpenChange={(open) => {
            if (!open) {
              setShowImportDialog(false)
              setExcelResults(null)
              setStructuredData(null)
            }
          }}
          excelResults={excelResults ?? undefined}
          structuredData={structuredData ?? undefined}
          onImport={handleImport}
          isImporting={isImporting}
        />
      )}
    </div>
  )
}
