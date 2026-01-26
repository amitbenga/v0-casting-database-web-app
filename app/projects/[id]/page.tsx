"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { ArrowLeft, Plus, Edit, MoreVertical, Users, Calendar, Film, UserCircle, Clapperboard } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { createBrowserClient } from "@/lib/supabase/client"
import { AddActorToProjectDialog } from "@/components/add-actor-to-project-dialog"
import { EditProjectDialog } from "@/components/edit-project-dialog"
import { EditProjectActorDialog } from "@/components/edit-project-actor-dialog"
import { CreateRoleDialog } from "@/components/create-role-dialog"
import { ProjectScriptsSection } from "@/components/project-scripts-section"
import Link from "next/link"
import { FileText } from "lucide-react"

export default function ProjectDetailPage() {
  const router = useRouter()
  const params = useParams()
  const projectId = typeof params?.id === "string" ? params.id : null

  const [project, setProject] = useState<any>(null)
  const [projectActors, setProjectActors] = useState<any[]>([])
  const [projectRoles, setProjectRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false)
  const [showEditActorDialog, setShowEditActorDialog] = useState(false)
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false)
  const [selectedProjectActor, setSelectedProjectActor] = useState<any>(null)
  const [loadedProjectId, setLoadedProjectId] = useState<string | null>(null)

  useEffect(() => {
    if (!projectId || projectId === loadedProjectId) return

    async function loadData() {
      setLoading(true)
      try {
        const supabase = createBrowserClient()

        const { data: projectData, error: projectError } = await supabase
          .from("casting_projects")
          .select("*")
          .eq("id", projectId)
          .single()

        if (projectError) throw projectError
        setProject(projectData)

        const { data: rolesData } = await supabase
          .from("project_roles")
          .select("*")
          .eq("project_id", projectId)
          .order("created_at")

        setProjectRoles(rolesData || [])

        const { data: actorsData } = await supabase
          .from("project_actors")
          .select(`*, actors (*)`)
          .eq("project_id", projectId)

        setProjectActors(actorsData || [])
        setLoadedProjectId(projectId)
      } catch (error) {
        console.error("Error loading project data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [projectId, loadedProjectId])

  const refreshRoles = useCallback(async () => {
    if (!projectId) return
    const supabase = createBrowserClient()
    const { data } = await supabase.from("project_roles").select("*").eq("project_id", projectId).order("created_at")
    setProjectRoles(data || [])
  }, [projectId])

  const refreshActors = useCallback(async () => {
    if (!projectId) return
    const supabase = createBrowserClient()
    const { data } = await supabase.from("project_actors").select(`*, actors (*)`).eq("project_id", projectId)
    setProjectActors(data || [])
  }, [projectId])

  const refreshProject = useCallback(async () => {
    if (!projectId) return
    const supabase = createBrowserClient()
    const { data } = await supabase.from("casting_projects").select("*").eq("id", projectId).single()
    if (data) setProject(data)
  }, [projectId])

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshRoles(), refreshActors()])
  }, [refreshRoles, refreshActors])

  const deleteRole = async (roleId: string) => {
    if (!confirm("האם למחוק תפקיד זה? כל השחקנים המשויכים יישארו בפרויקט ללא תפקיד.")) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("project_roles").delete().eq("id", roleId)

      if (error) throw error
      refreshAll()
    } catch (error) {
      console.error("Error deleting role:", error)
      alert("שגיאה במחיקת תפקיד")
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "not_started":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      case "casting":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "casted":
        return "bg-purple-500/10 text-purple-500 border-purple-500/20"
      case "recording":
        return "bg-orange-500/10 text-orange-500 border-orange-500/20"
      case "completed":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const getStatusLabel = (status: string) => {
    switch (status) {
      case "not_started":
        return "לא התחיל"
      case "casting":
        return "בליהוק"
      case "casted":
        return "ליהוק הושלם"
      case "recording":
        return "בהקלטה"
      case "completed":
        return "הושלם"
      default:
        return status
    }
  }

  const editProjectActor = (projectActor: any) => {
    setSelectedProjectActor(projectActor)
    setShowEditActorDialog(true)
  }

  async function removeActorFromProject(projectActorId: string) {
    if (!confirm("האם להסיר שחקן זה מהפרויקט?")) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("project_actors").delete().eq("id", projectActorId)

      if (error) throw error
      setProjectActors((prev) => prev.filter((pa) => pa.id !== projectActorId))
    } catch (error) {
      console.error("Error removing actor:", error)
      alert("שגיאה בהסרת שחקן")
    }
  }

  async function deleteProject() {
    if (!confirm("האם אתה בטוח שברצונך למחוק את הפרויקט? פעולה זו בלתי הפיכה.")) return
    if (!projectId) return

    try {
      const supabase = createBrowserClient()
      await supabase.from("project_actors").delete().eq("project_id", projectId)
      await supabase.from("project_roles").delete().eq("project_id", projectId)
      const { error } = await supabase.from("casting_projects").delete().eq("id", projectId)

      if (error) throw error
      router.push("/projects")
    } catch (error) {
      console.error("Error deleting project:", error)
      alert("שגיאה במחיקת פרויקט")
    }
  }

  const getActorsByRole = (roleId: string | null) => {
    if (roleId === null) {
      return projectActors.filter((pa) => !pa.role_id)
    }
    return projectActors.filter((pa) => pa.role_id === roleId)
  }

  const getGenderStyle = (gender: string) => {
    if (gender === "male") {
      return { bg: "bg-blue-100", text: "text-blue-600", symbol: "♂" }
    } else if (gender === "female") {
      return { bg: "bg-pink-100", text: "text-pink-600", symbol: "♀" }
    }
    return { bg: "bg-gray-100", text: "text-gray-600", symbol: "?" }
  }

  const getGenderLabel = (gender: string) => {
    if (gender === "male") return "זכר"
    if (gender === "female") return "נקבה"
    return gender
  }

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
                  <Badge variant="outline" className={getStatusColor(project.status)}>
                    {getStatusLabel(project.status)}
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

                <div className="flex items-start gap-3 pt-2">
                  <Users className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">שחקנים בפרויקט</p>
                    <p className="text-sm font-medium">{projectActors.length}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Clapperboard className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-xs text-muted-foreground">תפקידים</p>
                    <p className="text-sm font-medium">{projectRoles.length}</p>
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
                <TabsTrigger value="roles">תפקידים ({projectRoles.length})</TabsTrigger>
                <TabsTrigger value="actors">כל השחקנים ({projectActors.length})</TabsTrigger>
                <TabsTrigger value="scripts" className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  תסריטים
                </TabsTrigger>
              </TabsList>

              {/* תפקידים */}
              <TabsContent value="roles" className="space-y-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">תפקידים בפרויקט</h3>
                    <p className="text-sm text-muted-foreground">ניהול תפקידים ושיוך שחקנים</p>
                  </div>
                  <Button onClick={() => setShowCreateRoleDialog(true)}>
                    <Plus className="h-4 w-4 ml-2" />
                    תפקיד חדש
                  </Button>
                </div>

                {projectRoles.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Clapperboard className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין עדיין תפקידים</h3>
                    <p className="text-muted-foreground mb-6">צור תפקידים ושייך אליהם שחקנים</p>
                    <Button onClick={() => setShowCreateRoleDialog(true)}>
                      <Plus className="h-4 w-4 ml-2" />
                      צור תפקיד ראשון
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-6">
                    {projectRoles.map((role) => {
                      const roleActors = getActorsByRole(role.id)

                      return (
                        <Card key={role.id} className="overflow-hidden">
                          <div className="p-4 bg-muted/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <Clapperboard className="h-5 w-5 text-primary" />
                              <div>
                                <h4 className="font-semibold">{role.role_name}</h4>
                                <p className="text-sm text-muted-foreground">
                                  {roleActors.length} שחקנים • {role.replicas_needed || 0} רפליקות מתוכננות
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <Button variant="outline" size="sm" onClick={() => setShowAddDialog(true)}>
                                <Plus className="h-4 w-4 ml-1" />
                                הוסף שחקן
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon">
                                    <MoreVertical className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem>ערוך תפקיד</DropdownMenuItem>
                                  <DropdownMenuItem className="text-destructive" onClick={() => deleteRole(role.id)}>
                                    מחק תפקיד
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          {roleActors.length > 0 ? (
                            <div className="divide-y">
                              {roleActors.map((pa) => {
                                const actor = pa.actors
                                const currentAge = actor.birth_year ? new Date().getFullYear() - actor.birth_year : null
                                const genderStyle = getGenderStyle(actor.gender)

                                return (
                                  <div key={pa.id} className="p-4 flex items-center gap-4">
                                    <Link
                                      href={`/actors/${actor.id}`}
                                      className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 hover:opacity-80 transition-opacity"
                                    >
                                      {actor.image_url ? (
                                        <img
                                          src={actor.image_url || "/placeholder.svg"}
                                          alt={actor.full_name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div
                                          className={`w-full h-full flex items-center justify-center text-lg ${genderStyle.bg} ${genderStyle.text}`}
                                        >
                                          {genderStyle.symbol}
                                        </div>
                                      )}
                                    </Link>

                                    <div className="flex-1 min-w-0">
                                      <Link href={`/actors/${actor.id}`} className="hover:underline">
                                        <p className="font-medium">{actor.full_name}</p>
                                      </Link>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{getGenderLabel(actor.gender)}</span>
                                        {currentAge && (
                                          <>
                                            <span>•</span>
                                            <span>גיל {currentAge}</span>
                                          </>
                                        )}
                                        {pa.replicas_planned && (
                                          <>
                                            <span>•</span>
                                            <span>{pa.replicas_planned} רפליקות</span>
                                          </>
                                        )}
                                      </div>
                                    </div>

                                    <DropdownMenu>
                                      <DropdownMenuTrigger asChild>
                                        <Button variant="ghost" size="icon">
                                          <MoreVertical className="h-4 w-4" />
                                        </Button>
                                      </DropdownMenuTrigger>
                                      <DropdownMenuContent align="end">
                                        <DropdownMenuItem onClick={() => editProjectActor(pa)}>
                                          ערוך פרטים
                                        </DropdownMenuItem>
                                        <DropdownMenuItem
                                          className="text-destructive"
                                          onClick={() => removeActorFromProject(pa.id)}
                                        >
                                          הסר מהפרויקט
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-muted-foreground">
                              <p>אין שחקנים משויכים לתפקיד זה</p>
                            </div>
                          )}
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* כל השחקנים */}
              <TabsContent value="actors" className="space-y-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">כל השחקנים בפרויקט</h3>
                    <p className="text-sm text-muted-foreground">רשימת כל השחקנים המשויכים לפרויקט</p>
                  </div>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 ml-2" />
                    הוסף שחקן
                  </Button>
                </div>

                {projectActors.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין עדיין שחקנים</h3>
                    <p className="text-muted-foreground mb-6">הוסף שחקנים לפרויקט כדי להתחיל</p>
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4 ml-2" />
                      הוסף שחקן ראשון
                    </Button>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {projectActors.map((pa) => {
                      const actor = pa.actors
                      const currentAge = actor.birth_year ? new Date().getFullYear() - actor.birth_year : null
                      const genderStyle = getGenderStyle(actor.gender)
                      const role = projectRoles.find((r) => r.id === pa.role_id)

                      return (
                        <Card key={pa.id} className="p-4">
                          <div className="flex items-start gap-4">
                            <Link
                              href={`/actors/${actor.id}`}
                              className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0 hover:opacity-80 transition-opacity"
                            >
                              {actor.image_url ? (
                                <img
                                  src={actor.image_url || "/placeholder.svg"}
                                  alt={actor.full_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`w-full h-full flex items-center justify-center text-2xl ${genderStyle.bg} ${genderStyle.text}`}
                                >
                                  {genderStyle.symbol}
                                </div>
                              )}
                            </Link>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <Link href={`/actors/${actor.id}`} className="hover:underline">
                                    <p className="font-semibold">{actor.full_name}</p>
                                  </Link>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground mt-1">
                                    <span>{getGenderLabel(actor.gender)}</span>
                                    {currentAge && (
                                      <>
                                        <span>•</span>
                                        <span>גיל {currentAge}</span>
                                      </>
                                    )}
                                  </div>
                                </div>
                                <DropdownMenu>
                                  <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-8 w-8">
                                      <MoreVertical className="h-4 w-4" />
                                    </Button>
                                  </DropdownMenuTrigger>
                                  <DropdownMenuContent align="end">
                                    <DropdownMenuItem onClick={() => editProjectActor(pa)}>ערוך פרטים</DropdownMenuItem>
                                    <DropdownMenuItem
                                      className="text-destructive"
                                      onClick={() => removeActorFromProject(pa.id)}
                                    >
                                      הסר מהפרויקט
                                    </DropdownMenuItem>
                                  </DropdownMenuContent>
                                </DropdownMenu>
                              </div>

                              <div className="mt-2 space-y-1">
                                {role && (
                                  <Badge variant="secondary" className="text-xs">
                                    {role.role_name}
                                  </Badge>
                                )}
                                {pa.replicas_planned && (
                                  <p className="text-xs text-muted-foreground">
                                    {pa.replicas_planned} רפליקות מתוכננות
                                  </p>
                                )}
                              </div>
                            </div>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>

              {/* Scripts Tab */}
              <TabsContent value="scripts" className="mt-6">
                <ProjectScriptsSection projectId={projectId || ""} />
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

      {/* Dialogs - Pass only projectId instead of full objects where possible */}
      <AddActorToProjectDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={projectId || ""}
        roles={projectRoles}
        existingActorIds={projectActors.map((pa) => pa.actor_id)}
        onActorsAdded={refreshAll}
      />

      <EditProjectDialog
        open={showEditProjectDialog}
        onOpenChange={setShowEditProjectDialog}
        project={project}
        onProjectUpdated={refreshProject}
      />

      <EditProjectActorDialog
        open={showEditActorDialog}
        onOpenChange={setShowEditActorDialog}
        projectActor={selectedProjectActor}
        onActorUpdated={refreshActors}
      />

      <CreateRoleDialog
        open={showCreateRoleDialog}
        onOpenChange={setShowCreateRoleDialog}
        projectId={projectId || ""}
        onRoleCreated={refreshRoles}
      />
    </div>
  )
}
