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

  const loadScripts = useCallback(async () => {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("project_scripts")
        .select("*")
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
        .from("project_scripts")
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
              accept=".pdf,.doc,.docx,.txt"
              multiple
              onChange={handleFilesSelected}
              className="hidden"
            />
            <FileText className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
            <p className="text-sm font-medium">לחץ לבחירת קבצים או גרור לכאן</p>
            <p className="text-xs text-muted-foreground mt-1">
              תומך ב-TXT, PDF, DOC, DOCX
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
                      פרסר תסריטים ({pendingFiles.length})
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
                <li>בחר קבצי תסריט (ניתן לבחור מספר קבצים לפרויקט אחד)</li>
                <li>לחץ "פרסר תסריטים" - המערכת תזהה אוטומטית את התפקידים</li>
                <li>בדוק את התוצאות, ערוך ומזג תפקידים לפי הצורך</li>
                <li>אשר את התפקידים - הם יועברו לטאב "תפקידים" לשיבוץ</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview Dialog */}
      {parseResult && (
        <ScriptPreviewDialog
          open={showPreview}
          onOpenChange={setShowPreview}
          parseResult={parseResult}
          projectId={projectId}
          onApplied={() => {
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
