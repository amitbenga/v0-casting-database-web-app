"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Edit, MoreVertical, Users, Calendar, Film, UserCircle, Clapperboard, FileText, Loader2 } from "lucide-react"
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
import { createBrowserClient } from "@/lib/supabase/client"
import { PROJECT_STATUS_LABELS } from "@/lib/types"

const PROJECT_STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  casting: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  casted: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  recording: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
}

interface Project {
  id: string
  name: string
  status: string
  notes?: string
  director?: string
  casting_director?: string
  project_date?: string
  created_at: string
  updated_at: string
}

interface ProjectStats {
  rolesCount: number
  actorsCount: number
  scriptsCount: number
}

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = typeof params?.id === "string" ? params.id : null

  const [project, setProject] = useState<Project | null>(null)
  const [stats, setStats] = useState<ProjectStats>({ rolesCount: 0, actorsCount: 0, scriptsCount: 0 })
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState("roles")
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false)

  // Load project and stats
  const loadData = useCallback(async () => {
    if (!projectId) return
    
    setLoading(true)
    try {
      const supabase = createBrowserClient()
      
      // Load project
      const { data: projectData, error: projectError } = await supabase
        .from("casting_projects")
        .select("*")
        .eq("id", projectId)
        .single()

      if (projectError) throw projectError
      setProject(projectData)

      // Load stats
      const [rolesResult, castingsResult, scriptsResult] = await Promise.all([
        supabase.from("project_roles").select("id", { count: "exact" }).eq("project_id", projectId),
        supabase.from("role_castings").select("actor_id").eq("role_id", projectId), // This will be fixed below
        supabase.from("project_scripts").select("id", { count: "exact" }).eq("project_id", projectId),
      ])

      // Get unique actors from role_castings via roles
      const { data: roleIds } = await supabase
        .from("project_roles")
        .select("id")
        .eq("project_id", projectId)

      let actorsCount = 0
      if (roleIds && roleIds.length > 0) {
        const { data: castings } = await supabase
          .from("role_castings")
          .select("actor_id")
          .in("role_id", roleIds.map(r => r.id))
        
        if (castings) {
          actorsCount = new Set(castings.map(c => c.actor_id)).size
        }
      }

      setStats({
        rolesCount: rolesResult.count || 0,
        actorsCount,
        scriptsCount: scriptsResult.count || 0,
      })
    } catch (error) {
      console.error("Error loading project data:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadData()
  }, [loadData])

  // Delete project
  async function deleteProject() {
    if (!confirm("האם אתה בטוח שברצונך למחוק את הפרויקט? פעולה זו בלתי הפיכה.")) return
    if (!projectId) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from("casting_projects")
        .delete()
        .eq("id", projectId)

      if (error) throw error
      router.push("/projects")
    } catch (error) {
      console.error("Error deleting project:", error)
      alert("שגיאה במחיקת פרויקט")
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center space-y-4">
          <Loader2 className="h-12 w-12 animate-spin text-primary mx-auto" />
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
                  <Badge variant="outline" className={PROJECT_STATUS_COLORS[project.status] || ""}>
                    {PROJECT_STATUS_LABELS[project.status as keyof typeof PROJECT_STATUS_LABELS] || project.status}
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
                    <p className="text-sm font-medium">{stats.rolesCount}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">שחקנים בפרויקט</p>
                    <p className="text-sm font-medium">{stats.actorsCount}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <FileText className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">תסריטים</p>
                    <p className="text-sm font-medium">{stats.scriptsCount}</p>
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
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="roles">
                  תפקידים ({stats.rolesCount})
                </TabsTrigger>
                <TabsTrigger value="scripts">
                  תסריטים ({stats.scriptsCount})
                </TabsTrigger>
                <TabsTrigger value="actors">
                  שחקנים ({stats.actorsCount})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="roles" className="mt-6">
                <RolesTab projectId={project.id} />
              </TabsContent>

              <TabsContent value="scripts" className="mt-6">
                <ScriptsTab 
                  projectId={project.id} 
                  onScriptApplied={() => {
                    setActiveTab("roles")
                    loadData()
                  }}
                />
              </TabsContent>

              <TabsContent value="actors" className="mt-6">
                <ActorsTab projectId={project.id} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Edit Project Dialog */}
      {showEditProjectDialog && project && (
        <EditProjectDialog
          project={{
            id: project.id,
            name: project.name,
            status: project.status as any,
            notes: project.notes || "",
            created_at: project.created_at,
            updated_at: project.updated_at,
          }}
          open={showEditProjectDialog}
          onOpenChange={setShowEditProjectDialog}
          onSuccess={() => {
            loadData()
            setShowEditProjectDialog(false)
          }}
        />
      )}
    </div>
  )
}
