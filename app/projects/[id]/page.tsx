"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Edit, MoreVertical, Users, Calendar, Film, UserCircle, Clapperboard, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { EditProjectDialog } from "@/components/edit-project-dialog"
import { RolesTab } from "@/components/projects/roles-tab"
import { ScriptsTab } from "@/components/projects/scripts-tab"
import { ActorsTab } from "@/components/projects/actors-tab"
import { projectApi } from "@/lib/projects/api"
import type { Project, ProjectRole, RoleCasting, ScriptFile, ExtractedRole } from "@/lib/projects/types"
import { PROJECT_STATUS_LABELS, PROJECT_STATUS_COLORS } from "@/lib/projects/types"

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = typeof params?.id === "string" ? params.id : null

  const [project, setProject] = useState<Project | null>(null)
  const [roles, setRoles] = useState<ProjectRole[]>([])
  const [castings, setCastings] = useState<RoleCasting[]>([])
  const [scripts, setScripts] = useState<ScriptFile[]>([])
  const [extractedRoles, setExtractedRoles] = useState<ExtractedRole[]>([])
  const [loading, setLoading] = useState(true)
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false)

  // Load all data
  const loadData = useCallback(async () => {
    if (!projectId) return
    
    setLoading(true)
    try {
      const [projectData, rolesData, castingsData, scriptsData, extractedData] = await Promise.all([
        projectApi.getProject(projectId),
        projectApi.getRoles(projectId),
        projectApi.getCastings(projectId),
        projectApi.getScripts(projectId),
        projectApi.getExtractedRoles(projectId),
      ])

      setProject(projectData)
      setRoles(rolesData)
      setCastings(castingsData)
      setScripts(scriptsData)
      setExtractedRoles(extractedData)
    } catch (error) {
      console.error("Error loading project data:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Refresh functions
  const refreshRoles = useCallback(async () => {
    if (!projectId) return
    const data = await projectApi.getRoles(projectId)
    setRoles(data)
  }, [projectId])

  const refreshCastings = useCallback(async () => {
    if (!projectId) return
    const data = await projectApi.getCastings(projectId)
    setCastings(data)
  }, [projectId])

  const refreshScripts = useCallback(async () => {
    if (!projectId) return
    const [scriptsData, extractedData] = await Promise.all([
      projectApi.getScripts(projectId),
      projectApi.getExtractedRoles(projectId),
    ])
    setScripts(scriptsData)
    setExtractedRoles(extractedData)
  }, [projectId])

  const refreshProject = useCallback(async () => {
    if (!projectId) return
    const data = await projectApi.getProject(projectId)
    if (data) setProject(data)
  }, [projectId])

  // Delete project
  async function deleteProject() {
    if (!confirm("האם אתה בטוח שברצונך למחוק את הפרויקט? פעולה זו בלתי הפיכה.")) return
    if (!projectId) return

    try {
      await projectApi.deleteProject(projectId)
      router.push("/projects")
    } catch (error) {
      console.error("Error deleting project:", error)
      alert("שגיאה במחיקת פרויקט")
    }
  }

  // Compute stats
  const totalActors = new Set(castings.map(c => c.actor_id)).size
  const confirmedCastings = castings.filter(c => c.status === "confirmed").length

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="text-muted-foreground">טוען פרויקט...</p>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <p className="text-xl">פרויקט לא נמצא</p>
          <Button onClick={() => router.push("/projects")}>חזרה לפרויקטים</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card sticky top-0 z-10">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0 flex-1">
              <Button variant="ghost" size="icon" onClick={() => router.push("/projects")}>
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-3 flex-wrap">
                  <h1 className="text-xl md:text-2xl font-semibold truncate">{project.name}</h1>
                  <Badge variant="outline" className={PROJECT_STATUS_COLORS[project.status]}>
                    {PROJECT_STATUS_LABELS[project.status]}
                  </Badge>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                className="hidden md:flex bg-transparent"
                onClick={() => setShowEditProjectDialog(true)}
              >
                <Edit className="h-4 w-4 ml-2" />
                ערוך פרויקט
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="outline" size="icon">
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="md:hidden" onClick={() => setShowEditProjectDialog(true)}>
                    ערוך פרויקט
                  </DropdownMenuItem>
                  <DropdownMenuItem>ייצא פרויקט</DropdownMenuItem>
                  <DropdownMenuItem>שכפל</DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={deleteProject}>
                    מחק פרויקט
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 md:gap-8">
          {/* Sidebar */}
          <div className="space-y-6">
            <Card className="p-6 space-y-4">
              <h3 className="font-semibold text-lg">פרטי הפרויקט</h3>
              <Separator />

              <div className="space-y-4">
                {project.director && (
                  <div className="flex items-start gap-3">
                    <Film className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">במאי</p>
                      <p className="text-sm font-medium">{project.director}</p>
                    </div>
                  </div>
                )}

                {project.casting_director && (
                  <div className="flex items-start gap-3">
                    <UserCircle className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">מלהק</p>
                      <p className="text-sm font-medium">{project.casting_director}</p>
                    </div>
                  </div>
                )}

                {project.project_date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="h-5 w-5 text-muted-foreground mt-0.5" />
                    <div className="flex-1">
                      <p className="text-xs text-muted-foreground">תאריך פרויקט</p>
                      <p className="text-sm font-medium">
                        {new Date(project.project_date).toLocaleDateString("he-IL")}
                      </p>
                    </div>
                  </div>
                )}

                <Separator />

                <div className="flex items-start gap-3">
                  <Clapperboard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">תפקידים</p>
                    <p className="text-sm font-medium">{roles.length}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">שחקנים בפרויקט</p>
                    <p className="text-sm font-medium">{totalActors}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">תסריטים</p>
                    <p className="text-sm font-medium">{scripts.length}</p>
                  </div>
                </div>
              </div>
            </Card>

            {project.notes && (
              <Card className="p-6 space-y-4">
                <h3 className="font-semibold">הערות</h3>
                <Separator />
                <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{project.notes}</p>
              </Card>
            )}
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3 space-y-6">
            <Tabs defaultValue="roles" className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="roles">
                  תפקידים ({roles.length})
                </TabsTrigger>
                <TabsTrigger value="scripts">
                  תסריטים ({scripts.length})
                </TabsTrigger>
                <TabsTrigger value="actors">
                  שחקנים ({totalActors})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className="mt-6">
                <RolesTab
                  projectId={project.id}
                  roles={roles}
                  castings={castings}
                  onRolesChange={refreshRoles}
                  onCastingsChange={refreshCastings}
                />
              </TabsContent>

              <TabsContent value="scripts" className="mt-6">
                <ScriptsTab
                  projectId={project.id}
                  scripts={scripts}
                  extractedRoles={extractedRoles}
                  existingRoles={roles}
                  onScriptsChange={refreshScripts}
                  onRolesChange={refreshRoles}
                />
              </TabsContent>

              <TabsContent value="actors" className="mt-6">
                <ActorsTab
                  projectId={project.id}
                  roles={roles}
                  castings={castings}
                  onCastingsChange={refreshCastings}
                />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Edit Project Dialog */}
      {showEditProjectDialog && project && (
        <EditProjectDialog
          project={project}
          open={showEditProjectDialog}
          onOpenChange={setShowEditProjectDialog}
          onSuccess={() => {
            refreshProject()
            setShowEditProjectDialog(false)
          }}
        />
      )}
    </div>
  )
}
