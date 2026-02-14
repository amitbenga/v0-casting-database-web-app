"use client"

import React from "react"
import { useToast } from "@/hooks/use-toast"

import { useState, useEffect, useRef } from "react"
import { 
  FileText, 
  Upload, 
  Trash2, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  XCircle,
  Info,
  Users,
  ChevronDown,
  ChevronUp,
  File
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
  TableRow 
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { createClient } from "@/lib/supabase/client"
import type { 
  ProjectScript, 
  ScriptExtractedRole, 
  ScriptCastingWarning,
  ScriptProcessingStatus,
  ExtractedRoleType
} from "@/lib/types"
import { SCRIPT_STATUS_LABELS, ROLE_TYPE_LABELS } from "@/lib/types"
import { applyParsedScript } from "@/lib/actions/casting-actions"
import { toast } from "sonner"

interface ProjectScriptsSectionProps {
  projectId: string
}

export function ProjectScriptsSection({ projectId }: ProjectScriptsSectionProps) {
  const { toast } = useToast()
  const [scripts, setScripts] = useState<ProjectScript[]>([])
  const [extractedRoles, setExtractedRoles] = useState<ScriptExtractedRole[]>([])
  const [castingWarnings, setCastingWarnings] = useState<ScriptCastingWarning[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [applying, setApplying] = useState<string | null>(null)
  const [showWarnings, setShowWarnings] = useState(true)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Load data
  useEffect(() => {
    async function loadData() {
      const supabase = createClient()
      
      // Load scripts
      const { data: scriptsData } = await supabase
        .from("project_scripts")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
      
      if (scriptsData) {
        setScripts(scriptsData as ProjectScript[])
      }
      
      // Load extracted roles
      const { data: rolesData } = await supabase
        .from("script_extracted_roles")
        .select("*")
        .eq("project_id", projectId)
        .order("replicas_count", { ascending: false })
      
      if (rolesData) {
        setExtractedRoles(rolesData as ScriptExtractedRole[])
      }
      
      // Load casting warnings
      const { data: warningsData } = await supabase
        .from("script_casting_warnings")
        .select("*")
        .eq("project_id", projectId)
      
      if (warningsData) {
        setCastingWarnings(warningsData as ScriptCastingWarning[])
      }
      
      setLoading(false)
    }
    
    loadData()
  }, [projectId])

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return
    
    setUploading(true)
    
    try {
      const supabase = createClient()
      
      // For now, just create a record - actual file upload and processing
      // will be handled by the API integration later
      const { data, error } = await supabase
        .from("project_scripts")
        .insert({
          project_id: projectId,
          file_name: file.name,
          file_type: file.name.split('.').pop()?.toLowerCase(),
          file_size_bytes: file.size,
          processing_status: "uploaded"
        })
        .select()
        .single()
      
      if (error) throw error
      
      if (data) {
        setScripts(prev => [data as ProjectScript, ...prev])
      }
    } catch (error) {
      console.error("Error uploading script:", error)
      toast({ title: "שגיאה", description: "שגיאה בהעלאת הקובץ", variant: "destructive" })
    } finally {
      setUploading(false)
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  // Apply parsed script
  const handleApplyScript = async (scriptId: string) => {
    setApplying(scriptId)
    try {
      const result = await applyParsedScript(projectId, scriptId)
      if (result.success) {
        toast.success("התפקידים והאזהרות הוחלו על הפרויקט בהצלחה")
        // Refresh scripts to show updated status
        const supabase = createClient()
        const { data: scriptsData } = await supabase
          .from("project_scripts")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at", { ascending: false })
        if (scriptsData) setScripts(scriptsData as ProjectScript[])
      } else {
        toast.error(`שגיאה בהחלת התסריט: ${result.error}`)
      }
    } catch (error) {
      console.error("Error applying script:", error)
      toast.error("שגיאה בלתי צפויה בהחלת התסריט")
    } finally {
      setApplying(null)
    }
  }

  // Delete script
  const handleDeleteScript = async (scriptId: string) => {
    if (!confirm("האם למחוק את התסריט? פעולה זו תמחק גם את כל התפקידים שחולצו ממנו.")) {
      return
    }
    
    try {
      const supabase = createClient()
      const { error } = await supabase
        .from("project_scripts")
        .delete()
        .eq("id", scriptId)
      
      if (error) throw error
      
      setScripts(prev => prev.filter(s => s.id !== scriptId))
      setExtractedRoles(prev => prev.filter(r => r.script_id !== scriptId))
    } catch (error) {
      console.error("Error deleting script:", error)
      toast({ title: "שגיאה", description: "שגיאה במחיקת התסריט", variant: "destructive" })
    }
  }

  // Get status icon
  const getStatusIcon = (status: ScriptProcessingStatus) => {
    switch (status) {
      case "uploaded":
        return <Clock className="h-4 w-4 text-muted-foreground" />
      case "processing":
        return <Clock className="h-4 w-4 text-blue-500 animate-pulse" />
      case "completed":
        return <CheckCircle className="h-4 w-4 text-green-500" />
      case "error":
        return <XCircle className="h-4 w-4 text-red-500" />
    }
  }

  // Get role type badge color
  const getRoleTypeBadgeClass = (type: ExtractedRoleType) => {
    switch (type) {
      case "regular":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300"
      case "combined":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
      case "group":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900 dark:text-purple-300"
      case "ambiguous":
        return "bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300"
    }
  }

  // Format file size
  const formatFileSize = (bytes?: number) => {
    if (!bytes) return "-"
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <p className="text-muted-foreground">טוען תסריטים...</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header with Upload Button */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">תסריטים ותפקידים</h2>
          <p className="text-sm text-muted-foreground">
            העלה קבצי תסריט לחילוץ אוטומטי של תפקידים
          </p>
        </div>
        <div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.doc,.docx,.txt"
            onChange={handleFileUpload}
            className="hidden"
            id="script-upload"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
          >
            <Upload className="h-4 w-4 ml-2" />
            {uploading ? "מעלה..." : "העלה תסריט"}
          </Button>
        </div>
      </div>

      {/* Uploaded Scripts */}
      {scripts.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <FileText className="h-4 w-4" />
              קבצים שהועלו ({scripts.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם קובץ</TableHead>
                  <TableHead className="text-right">גודל</TableHead>
                  <TableHead className="text-right">סטטוס</TableHead>
                  <TableHead className="text-right">תאריך העלאה</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scripts.map((script) => (
                  <TableRow key={script.id}>
                    <TableCell className="font-medium">
                      <div className="flex items-center gap-2">
                        <File className="h-4 w-4 text-muted-foreground" />
                        {script.file_name}
                      </div>
                    </TableCell>
                    <TableCell>{formatFileSize(script.file_size_bytes)}</TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {getStatusIcon(script.processing_status)}
                        <span>{SCRIPT_STATUS_LABELS[script.processing_status]}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      {new Date(script.created_at).toLocaleDateString("he-IL")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        {script.processing_status === "completed" ? (
                          <Badge variant="secondary" className="bg-green-100 text-green-700 hover:bg-green-100">
                            הוחל
                          </Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-8 text-xs"
                            onClick={() => handleApplyScript(script.id)}
                            disabled={applying === script.id || script.processing_status === "error"}
                          >
                            {applying === script.id ? "מחיל..." : "החל על הפרויקט"}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-red-500 hover:text-red-600 hover:bg-red-50"
                          onClick={() => handleDeleteScript(script.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Casting Warnings */}
      {castingWarnings.length > 0 && (
        <Collapsible open={showWarnings} onOpenChange={setShowWarnings}>
          <Card className="border-yellow-200 bg-yellow-50/50 dark:border-yellow-800 dark:bg-yellow-950/20">
            <CollapsibleTrigger asChild>
              <CardHeader className="pb-3 cursor-pointer hover:bg-yellow-100/50 dark:hover:bg-yellow-900/20 transition-colors">
                <CardTitle className="text-base flex items-center justify-between">
                  <div className="flex items-center gap-2 text-yellow-700 dark:text-yellow-400">
                    <AlertTriangle className="h-4 w-4" />
                    אזהרות ליהוק ({castingWarnings.length})
                  </div>
                  {showWarnings ? (
                    <ChevronUp className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  )}
                </CardTitle>
              </CardHeader>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <CardContent className="pt-0">
                <div className="space-y-2">
                  {castingWarnings.map((warning) => (
                    <div
                      key={warning.id}
                      className="flex items-center gap-3 p-3 rounded-md bg-background border"
                    >
                      <Users className="h-4 w-4 text-yellow-600 flex-shrink-0" />
                      <div className="flex-1">
                        <p className="text-sm">
                          <span className="font-medium">{warning.role_1_name}</span>
                          {" ו-"}
                          <span className="font-medium">{warning.role_2_name}</span>
                          {" מופיעים יחד באותו סצנה"}
                        </p>
                        {warning.scene_reference && (
                          <p className="text-xs text-muted-foreground mt-1">
                            {warning.scene_reference}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Extracted Roles Table */}
      {extractedRoles.length > 0 ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                תפקידים שחולצו ({extractedRoles.length})
              </div>
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <Info className="h-4 w-4 text-muted-foreground" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="left" className="max-w-xs text-right">
                    <p>התפקידים חולצו אוטומטית מהתסריטים שהועלו.</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      משולב = תפקיד שמשלב כמה דמויות | קבוצתי = מקהלה/רקע
                    </p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">שם תפקיד</TableHead>
                  <TableHead className="text-right">סוג</TableHead>
                  <TableHead className="text-right">רפליקות</TableHead>
                  <TableHead className="text-right">מקור</TableHead>
                  <TableHead className="text-right">הערות</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {extractedRoles.map((role) => (
                  <TableRow key={role.id}>
                    <TableCell className="font-medium">{role.role_name}</TableCell>
                    <TableCell>
                      <Badge 
                        variant="outline" 
                        className={getRoleTypeBadgeClass(role.role_type)}
                      >
                        {ROLE_TYPE_LABELS[role.role_type]}
                      </Badge>
                    </TableCell>
                    <TableCell>{role.replicas_count || "-"}</TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {role.first_appearance_script || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm max-w-[200px] truncate">
                      {role.notes || "-"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : scripts.length > 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Clock className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              התסריטים ממתינים לעיבוד.
              <br />
              <span className="text-sm">התפקידים יוצגו כאן לאחר השלמת העיבוד.</span>
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12">
            <FileText className="h-12 w-12 text-muted-foreground/50 mb-4" />
            <p className="text-muted-foreground text-center">
              לא הועלו תסריטים עדיין.
              <br />
              <span className="text-sm">העלה קובץ תסריט כדי לחלץ תפקידים אוטומטית.</span>
            </p>
            <Button 
              variant="outline" 
              className="mt-4 bg-transparent"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-4 w-4 ml-2" />
              העלה תסריט ראשון
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
