"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import {
  FileText,
  Upload,
  Trash2,
  CheckCircle,
  Clock,
  XCircle,
  Loader2,
  Play,
  AlertTriangle,
  X,
  Users,
  AlertCircle,
  ChevronRight,
  Eye,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { createBrowserClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { parseScriptFiles, type ParsedScriptBundle } from "@/lib/parser"
import { ScriptPreviewDialog } from "./script-preview-dialog"
import { parseExcelFile, isExcelFile, autoDetectScriptLineColumns, parseScriptLinesFromExcel, type ExcelParseResult, type ExcelMappedRole, type ScriptLineColumnMapping } from "@/lib/parser/excel-parser"
import { ExcelPreviewDialog } from "./excel-preview-dialog"
import { FileSpreadsheet } from "lucide-react"
import { saveScriptLines } from "@/lib/actions/script-line-actions"

interface ProjectScript {
  id: string
  project_id: string
  file_name: string
  file_url?: string
  file_type: string
  file_size_bytes?: number
  processing_status: "uploaded" | "processing" | "completed" | "error"
  processing_error?: string
  applied_at?: string
  created_at: string
}

interface ScriptsTabProps {
  projectId: string
  onScriptApplied?: () => void
}

interface PendingFile {
  file: File
  id: string
  status: "pending" | "parsing" | "parsed" | "error"
  error?: string
}

export function ScriptsTab({ projectId, onScriptApplied }: ScriptsTabProps) {
  const { toast } = useToast()
  const [scripts, setScripts] = useState<ProjectScript[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingFiles, setPendingFiles] = useState<PendingFile[]>([])
  const [isParsing, setIsParsing] = useState(false)
  const [parseResult, setParseResult] = useState<ParsedScriptBundle | null>(null)
  const [showPreview, setShowPreview] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const excelInputRef = useRef<HTMLInputElement>(null)
  const [excelResult, setExcelResult] = useState<ExcelParseResult | null>(null)
  const [showExcelPreview, setShowExcelPreview] = useState(false)
  const [isApplyingExcel, setIsApplyingExcel] = useState(false)

  const loadScripts = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("casting_project_scripts")
        .select("id, project_id, file_name, file_url, file_type, file_size_bytes, processing_status, processing_error, applied_at, created_at")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })

      if (error) throw error
      setScripts(data || [])
    } catch (error) {
      console.error("Error loading scripts:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadScripts()
  }, [loadScripts])

  const handleFilesSelected = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    const newPendingFiles: PendingFile[] = Array.from(files).map(file => ({
      file,
      id: `${file.name}-${Date.now()}-${Math.random()}`,
      status: "pending"
    }))

    setPendingFiles(prev => [...prev, ...newPendingFiles])
    setParseResult(null)

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  const removePendingFile = (id: string) => {
    setPendingFiles(prev => prev.filter(f => f.id !== id))
    if (pendingFiles.length === 1) {
      setParseResult(null)
    }
  }

  const clearAllPendingFiles = () => {
    setPendingFiles([])
    setParseResult(null)
  }

  const handleParseFiles = async () => {
    if (pendingFiles.length === 0) return

    setIsParsing(true)
    setParseResult(null)

    // Mark all as parsing
    setPendingFiles(prev => prev.map(f => ({ ...f, status: "parsing" })))

    try {
      const files = pendingFiles.map(pf => pf.file)
      const result = await parseScriptFiles(files)

      // Update file statuses based on result
      setPendingFiles(prev => prev.map(pf => {
        const fileResult = result.files.find(f => f.name === pf.file.name)
        return {
          ...pf,
          status: fileResult?.status === "success" ? "parsed" : "error",
          error: fileResult?.error
        }
      }))

      setParseResult(result)

      if (result.parseResult.characters.length > 0) {
        toast({
          title: "הפרסור הושלם",
          description: `זוהו ${result.parseResult.characters.length} תפקידים מתוך ${result.files.filter(f => f.status === "success").length} קבצים`,
        })
        setShowPreview(true)
      } else {
        toast({
          title: "לא נמצאו תפקידים",
          description: "נסה להעלות קובץ בפורמט תסריט סטנדרטי",
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Parse error:", error)
      toast({
        title: "שגיאה בפרסור",
        description: error instanceof Error ? error.message : "שגיאה לא ידועה",
        variant: "destructive",
      })
      setPendingFiles(prev => prev.map(f => ({ ...f, status: "error", error: "Parse failed" })))
    } finally {
      setIsParsing(false)
    }
  }

  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm("האם למחוק את התסריט?")) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from("casting_project_scripts")
        .delete()
        .eq("id", scriptId)

      if (error) throw error

      setScripts(prev => prev.filter(s => s.id !== scriptId))
      toast({ title: "התסריט נמחק" })
    } catch (error) {
      console.error("Error deleting script:", error)
      toast({
        title: "שגיאה במחיקת התסריט",
        variant: "destructive",
      })
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const getStatusBadge = (status: ProjectScript["processing_status"], appliedAt?: string) => {
    if (appliedAt) {
      return (
        <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 gap-1">
          <CheckCircle className="h-3 w-3" />
          הוחל
        </Badge>
      )
    }
    
    switch (status) {
      case "uploaded":
        return (
          <Badge variant="outline" className="text-muted-foreground gap-1">
            <Clock className="h-3 w-3" />
            הועלה
          </Badge>
        )
      case "processing":
        return (
          <Badge variant="outline" className="text-blue-600 border-blue-200 gap-1">
            <Loader2 className="h-3 w-3 animate-spin" />
            בעיבוד
          </Badge>
        )
      case "completed":
        return (
          <Badge variant="outline" className="text-green-600 border-green-200 gap-1">
            <CheckCircle className="h-3 w-3" />
            הושלם
          </Badge>
        )
      case "error":
        return (
          <Badge variant="outline" className="text-red-600 border-red-200 gap-1">
            <XCircle className="h-3 w-3" />
            שגיאה
          </Badge>
        )
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Upload className="h-5 w-5" />
            העלאת תסריטים
          </CardTitle>
          <CardDescription>
            העלה קבצי תסריט לפרסור אוטומטי. ניתן להעלות מספר קבצים יחד כתסריט אחד.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* File Input Area */}
          <div
            className="border-2 border-dashed rounded-lg p-8 text-center hover:border-primary/50 hover:bg-muted/50 transition-colors cursor-pointer"
            onClick={() => fileInputRef.current?.click()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt,.xlsx,.xls,.csv"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">לחץ לבחירת קבצים או גרור לכאן</p>
            <p className="text-xs text-muted-foreground mt-1">
              תומך ב-TXT, PDF, DOCX, XLSX, XLS, CSV (קובץ DOC ישן — יש להמיר ל-DOCX)
            </p>
          </div>

          {/* Excel Import Area */}
          <div
            className="border-2 border-dashed border-green-300 dark:border-green-700 rounded-lg p-6 text-center hover:border-green-400 hover:bg-green-50/50 dark:hover:bg-green-950/20 transition-colors cursor-pointer"
            onClick={() => excelInputRef.current?.click()}
          >
            <input
              ref={excelInputRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file) return
                try {
                  const result = await parseExcelFile(file)
                  setExcelResult(result)
                  setShowExcelPreview(true)
                  toast({ title: "קובץ Excel נקרא בהצלחה", description: `${result.totalRows} שורות נמצאו` })
                } catch (err) {
                  toast({ title: "שגיאה בקריאת קובץ Excel", description: err instanceof Error ? err.message : "שגיאה לא ידועה", variant: "destructive" })
                }
                if (excelInputRef.current) excelInputRef.current.value = ""
              }}
              className="hidden"
            />
            <FileSpreadsheet className="h-10 w-10 mx-auto text-green-600 dark:text-green-400 mb-3" />
            <p className="text-sm font-medium">ייבוא תפקידים מקובץ Excel</p>
            <p className="text-xs text-muted-foreground mt-1">
              תומך ב-XLSX, XLS - מיפוי עמודות ידני
            </p>
          </div>

          {/* Pending Files List */}
          {pendingFiles.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-medium">קבצים לפרסור ({pendingFiles.length})</h4>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearAllPendingFiles}
                  className="text-muted-foreground"
                >
                  נקה הכל
                </Button>
              </div>

              <div className="space-y-2">
                {pendingFiles.map(pf => (
                  <div
                    key={pf.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-3">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm font-medium">{pf.file.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatFileSize(pf.file.size)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {pf.status === "parsing" && (
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                      )}
                      {pf.status === "parsed" && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                      {pf.status === "error" && (
                        <div className="flex items-center gap-1 text-red-500">
                          <XCircle className="h-4 w-4" />
                          <span className="text-xs">{pf.error}</span>
                        </div>
                      )}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7"
                        onClick={() => removePendingFile(pf.id)}
                        disabled={isParsing}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>

              {/* Parse Button */}
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleParseFiles}
                  disabled={isParsing || pendingFiles.length === 0}
                  className="flex-1"
                >
                  {isParsing ? (
                    <>
                      <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                      מפרסר...
                    </>
                  ) : (
                    <>
                      <Play className="h-4 w-4 ml-2" />
                      חלץ תפקידים ({pendingFiles.length})
                    </>
                  )}
                </Button>
                
                {parseResult && (
                  <Button
                    variant="outline"
                    onClick={() => setShowPreview(true)}
                  >
                    <Eye className="h-4 w-4 ml-2" />
                    צפה בתוצאות
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Parse Result Summary */}
          {parseResult && parseResult.parseResult.characters.length > 0 && (
            <div className="p-4 bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg">
              <div className="flex items-start gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="font-medium text-green-800 dark:text-green-200">
                    הפרסור הושלם בהצלחה
                  </p>
                  <div className="flex items-center gap-4 mt-2 text-sm text-green-700 dark:text-green-300">
                    <span className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      {parseResult.parseResult.characters.length} תפקידים
                    </span>
                    <span>
                      {parseResult.parseResult.metadata.totalReplicas} רפליקות
                    </span>
                    {parseResult.parseResult.warnings.filter(w => w.type === "interaction").length > 0 && (
                      <span className="flex items-center gap-1">
                        <AlertCircle className="h-4 w-4" />
                        {parseResult.parseResult.warnings.filter(w => w.type === "interaction").length} קונפליקטים
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    className="mt-3"
                    onClick={() => setShowPreview(true)}
                  >
                    צפה ואשר תפקידים
                    <ChevronRight className="h-4 w-4 mr-2" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Existing Scripts */}
      {scripts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              תסריטים קיימים ({scripts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם קובץ</TableHead>
                  <TableHead className="text-right">גודל</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">תאריך</TableHead>
                  <TableHead className="text-right w-[100px]">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.map(script => (
                  <TableRow key={script.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="truncate">{script.file_name}</span>
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(script.file_size_bytes)}</TableCell>
                    <TableCell>
                      {getStatusBadge(script.processing_status, script.applied_at)}
                      {script.processing_error && (
                        <p className="text-xs text-red-500 mt-1">
                          {script.processing_error}
                        </p>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(script.created_at).toLocaleDateString("he-IL")}
                    </TableCell>
                    <TableCell>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={() => handleDeleteScript(script.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardContent className="py-4">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium">איך זה עובד?</p>
              <ol className="mt-2 space-y-1 text-muted-foreground list-decimal list-inside">
                <li>בחר קבצי תסריט — PDF, DOCX, TXT (לא DOC ישן)</li>
                <li>לחץ "חלץ תפקידים" — המערכת תזהה אוטומטית את הדמויות</li>
                <li>בדוק, ערוך ומזג תפקידים לפי הצורך</li>
                <li>אשר — התפקידים וסביבת העבודה יתמלאו אוטומטית</li>
              </ol>
              <p className="mt-2 text-xs text-amber-600 dark:text-amber-400 font-medium">
                שים לב: אישור תסריט חדש מחליף את כל שורות סביבת העבודה הקיימות.
              </p>
              <p className="mt-2 text-xs text-muted-foreground">
                לייבוא Excel עם שורות מפורטות (TC, תרגום וכו') — השתמש בכפתור הירוק למעלה
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Excel Preview Dialog */}
      {excelResult && (
        <ExcelPreviewDialog
          open={showExcelPreview}
          onOpenChange={setShowExcelPreview}
          excelResult={excelResult}
          isApplying={isApplyingExcel}
          onApply={async (roles: ExcelMappedRole[]) => {
            setIsApplyingExcel(true)
            try {
              const supabase = createBrowserClient()
              const rolesToInsert = roles.map(r => ({
                project_id: projectId,
                role_name: r.role_name,
                role_name_normalized: r.role_name_normalized,
                replicas_needed: r.replicas_needed,
                source: r.source,
              }))
              const { error } = await supabase.from("project_roles").insert(rolesToInsert)
              if (error) throw error

              // Agent 3: Auto-sync — detect and save script lines from the same Excel
              let linesSynced = 0
              if (excelResult) {
                try {
                  const sheet = excelResult.sheets[0]
                  const lineMapping = autoDetectScriptLineColumns(sheet)
                  // Only auto-import if this looks like a line-by-line script (has timecode or source text)
                  const hasLineData = !!(lineMapping.timecodeColumn || lineMapping.sourceTextColumn)
                  if (lineMapping.roleNameColumn && hasLineData) {
                    // Construct full mapping (roleNameColumn is confirmed truthy above)
                    const fullMapping: ScriptLineColumnMapping = {
                      sheetIndex: lineMapping.sheetIndex ?? 0,
                      roleNameColumn: lineMapping.roleNameColumn,
                      timecodeColumn: lineMapping.timecodeColumn,
                      sourceTextColumn: lineMapping.sourceTextColumn,
                      translationColumn: lineMapping.translationColumn,
                      recStatusColumn: lineMapping.recStatusColumn,
                      notesColumn: lineMapping.notesColumn,
                      skipEmptyRole: lineMapping.skipEmptyRole ?? true,
                    }
                    const scriptLines = parseScriptLinesFromExcel(sheet, fullMapping)
                    if (scriptLines.length > 0) {
                      const syncResult = await saveScriptLines(projectId, scriptLines, { replaceAll: true })
                      if (syncResult.success) {
                        linesSynced = syncResult.linesCreated ?? 0
                      }
                    }
                  }
                } catch (lineErr) {
                  // Non-critical: role import succeeded, line sync failed
                  console.warn("Auto-sync script lines failed (non-critical):", lineErr)
                }
              }

              const description = linesSynced > 0
                ? `${roles.length} תפקידים + ${linesSynced} שורות יובאו לסביבת העבודה`
                : `${roles.length} תפקידים נוספו מקובץ Excel`
              toast({ title: "ייבוא הצליח", description })
              setShowExcelPreview(false)
              setExcelResult(null)
              onScriptApplied?.()
            } catch (err) {
              console.error("Excel apply error:", err)
              toast({ title: "שגיאה בייבוא תפקידים", description: err instanceof Error ? err.message : "שגיאה לא ידועה", variant: "destructive" })
            } finally {
              setIsApplyingExcel(false)
            }
          }}
        />
      )}

      {/* Preview Dialog */}
      {parseResult && (
        <ScriptPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          parseResult={parseResult}
          projectId={projectId}
          fileInfo={pendingFiles.map(pf => ({
            name: pf.file.name,
            type: pf.file.type || pf.file.name.split('.').pop() || 'unknown',
            size: pf.file.size,
          }))}
          onApplied={async (scriptId?: string) => {
            // Create stub script_lines from parsed characters so the workspace
            // immediately shows rows after DOCX/PDF upload. script_id is now
            // populated so rows are linked to the casting_project_scripts record.
            if (parseResult && parseResult.parseResult.characters.length > 0) {
              try {
                let lineNum = 1
                const stubs: Array<{ line_number: number; role_name: string }> = []
                for (const char of parseResult.parseResult.characters) {
                  const replicas = Math.min(char.replicaCount, 500)
                  for (let i = 0; i < replicas; i++) {
                    stubs.push({ line_number: lineNum++, role_name: char.name })
                  }
                }
                if (stubs.length > 0) {
                  await saveScriptLines(projectId, stubs, { replaceAll: true, scriptId })
                }
              } catch (e) {
                // Non-critical: roles were applied, stub creation failed
                console.warn("Stub script_lines creation failed (non-critical):", e)
              }
            }
            setShowPreview(false)
            setPendingFiles([])
            setParseResult(null)
            loadScripts()
            onScriptApplied?.()
          }}
        />
      )}
    </div>
  )
}
