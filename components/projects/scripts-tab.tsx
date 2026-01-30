"use client"

import { useState, useEffect, useRef } from "react"
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
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
import { applyParsedScript } from "@/lib/actions/casting-actions"
import type { ScriptProcessingStatus } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface ProjectScript {
  id: string
  project_id: string
  file_name: string
  file_url?: string
  file_type: string
  file_size_bytes?: number
  processing_status: ScriptProcessingStatus
  processing_error?: string
  created_at: string
}

interface ScriptsTabProps {
  projectId: string
  onScriptApplied?: () => void
}

const STATUS_CONFIG: Record<
  ScriptProcessingStatus,
  { label: string; icon: React.ReactNode; color: string }
> = {
  uploaded: {
    label: "הועלה",
    icon: <Clock className="h-4 w-4" />,
    color: "text-muted-foreground",
  },
  processing: {
    label: "בעיבוד",
    icon: <Loader2 className="h-4 w-4 animate-spin" />,
    color: "text-blue-500",
  },
  completed: {
    label: "הושלם",
    icon: <CheckCircle className="h-4 w-4" />,
    color: "text-green-500",
  },
  error: {
    label: "שגיאה",
    icon: <XCircle className="h-4 w-4" />,
    color: "text-red-500",
  },
}

export function ScriptsTab({ projectId, onScriptApplied }: ScriptsTabProps) {
  const { toast } = useToast()
  const [scripts, setScripts] = useState<ProjectScript[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [applyingScriptId, setApplyingScriptId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const loadScripts = async () => {
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
  }

  useEffect(() => {
    loadScripts()
  }, [projectId])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    setUploading(true)

    try {
      const supabase = createBrowserClient()

      // Create script record
      const { data, error } = await supabase
        .from("project_scripts")
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_type: file.name.split(".").pop()?.toLowerCase() || "unknown",
          file_size_bytes: file.size,
          processing_status: "uploaded",
        })
        .select()
        .single()

      if (error) throw error

      setScripts((prev) => [data as ProjectScript, ...prev])

      toast({
        title: "הקובץ הועלה בהצלחה",
        description: `${file.name} נוסף לפרויקט`,
      })
    } catch (error) {
      console.error("Error uploading script:", error)
      toast({
        title: "שגיאה בהעלאת הקובץ",
        variant: "destructive",
      })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
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

      setScripts((prev) => prev.filter((s) => s.id !== scriptId))

      toast({
        title: "התסריט נמחק",
      })
    } catch (error) {
      console.error("Error deleting script:", error)
      toast({
        title: "שגיאה במחיקת התסריט",
        variant: "destructive",
      })
    }
  }

  const handleApplyScript = async (scriptId: string) => {
    setApplyingScriptId(scriptId)

    try {
      const result = await applyParsedScript(scriptId)

      if (result.success) {
        toast({
          title: "התסריט הוחל בהצלחה",
          description: `נוצרו ${result.rolesCreated} תפקידים ו-${result.conflictsCreated} אזהרות קונפליקט`,
        })

        // Refresh scripts list
        await loadScripts()

        // Notify parent to switch to roles tab
        onScriptApplied?.()
      } else {
        toast({
          title: "שגיאה בהחלת התסריט",
          description: result.error,
          variant: "destructive",
        })
      }
    } catch (error) {
      console.error("Error applying script:", error)
      toast({
        title: "שגיאה בהחלת התסריט",
        variant: "destructive",
      })
    } finally {
      setApplyingScriptId(null)
    }
  }

  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">תסריטים</h2>
          <p className="text-sm text-muted-foreground">
            העלה קבצי תסריט ויישם אותם על הפרויקט
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} disabled={uploading}>
            {uploading ? (
              <Loader2 className="h-4 w-4 ml-2 animate-spin" />
            ) : (
              <Upload className="h-4 w-4 ml-2" />
            )}
            {uploading ? "מעלה..." : "העלה תסריט"}
          </Button>
        </div>
      </div>

      {/* Scripts Table */}
      {scripts.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              קבצים ({scripts.length})
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
                  <TableHead className="text-right w-[200px]">פעולות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.map((script) => {
                  const statusConfig = STATUS_CONFIG[script.processing_status]
                  const isApplying = applyingScriptId === script.id
                  const canApply = script.processing_status === "completed"

                  return (
                    <TableRow key={script.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                          <span className="truncate">{script.file_name}</span>
                        </div>
                      </TableCell>
                      <TableCell>{formatFileSize(script.file_size_bytes)}</TableCell>
                      <TableCell>
                        <div className={`flex items-center gap-2 ${statusConfig.color}`}>
                          {statusConfig.icon}
                          <span>{statusConfig.label}</span>
                        </div>
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
                        <div className="flex items-center gap-2">
                          {canApply && (
                            <Button
                              size="sm"
                              onClick={() => handleApplyScript(script.id)}
                              disabled={isApplying}
                            >
                              {isApplying ? (
                                <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                              ) : (
                                <Play className="h-4 w-4 ml-2" />
                              )}
                              החלה על הפרויקט
                            </Button>
                          )}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleDeleteScript(script.id)}
                            disabled={isApplying}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              לא הועלו תסריטים עדיין
            </p>
            <p className="text-sm text-muted-foreground text-center mt-1">
              העלה קובץ תסריט כדי להתחיל
            </p>
            <Button
              variant="outline"
              className="mt-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 ml-2" />
              העלה תסריט ראשון
            </Button>
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
                <li>העלה קובץ תסריט (PDF, DOC, DOCX או TXT)</li>
                <li>המערכת תעבד את הקובץ ותחלץ תפקידים</li>
                <li>כשהסטטוס "הושלם" - לחץ על "החלה על הפרויקט"</li>
                <li>התפקידים יועברו לטאב "תפקידים" ותוכל לשבץ שחקנים</li>
              </ol>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
