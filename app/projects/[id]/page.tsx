"use client"

import { useState, useEffect, useRef } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowLeft,
  Plus,
  Edit,
  MoreVertical,
  Users,
  Calendar,
  Film,
  UserCircle,
  Trash2,
  Clapperboard,
} from "lucide-react"
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
import Link from "next/link"

export default function ProjectDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter()
  const [project, setProject] = useState<any>(null)
  const [projectActors, setProjectActors] = useState<any[]>([])
  const [projectRoles, setProjectRoles] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showAddDialog, setShowAddDialog] = useState(false)
  const [showEditProjectDialog, setShowEditProjectDialog] = useState(false)
  const [showEditActorDialog, setShowEditActorDialog] = useState(false)
  const [showCreateRoleDialog, setShowCreateRoleDialog] = useState(false)
  const [selectedProjectActor, setSelectedProjectActor] = useState<any>(null)
  const isInitialLoad = useRef(true)

  useEffect(() => {
    if (!isInitialLoad.current) return
    isInitialLoad.current = false

    async function loadData() {
      try {
        const supabase = createBrowserClient()

        // טוען פרטי פרויקט
        const { data: projectData, error: projectError } = await supabase
          .from("casting_projects")
          .select("*")
          .eq("id", params.id)
          .single()

        if (projectError) throw projectError
        setProject(projectData)

        // טוען תפקידים
        const { data: rolesData, error: rolesError } = await supabase
          .from("project_roles")
          .select("*")
          .eq("project_id", params.id)
          .order("created_at")

        if (!rolesError) {
          setProjectRoles(rolesData || [])
        }

        // טוען שחקני פרויקט
        const { data: actorsData, error: actorsError } = await supabase
          .from("project_actors")
          .select(`
            *,
            actors (*)
          `)
          .eq("project_id", params.id)

        if (actorsError) throw actorsError
        setProjectActors(actorsData || [])
      } catch (error) {
        console.error("[v0] Error loading project data:", error)
      } finally {
        setLoading(false)
      }
    }

    loadData()
  }, [params.id])

  const refreshAll = async () => {
    try {
      const supabase = createBrowserClient()

      // רענון תפקידים
      const { data: rolesData } = await supabase
        .from("project_roles")
        .select("*")
        .eq("project_id", params.id)
        .order("created_at")

      setProjectRoles(rolesData || [])

      // רענון שחקנים
      const { data: actorsData } = await supabase
        .from("project_actors")
        .select(`*, actors (*)`)
        .eq("project_id", params.id)

      setProjectActors(actorsData || [])
    } catch (error) {
      console.error("[v0] Error refreshing data:", error)
    }
  }

  const refreshProject = async () => {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase.from("casting_projects").select("*").eq("id", params.id).single()

      if (error) throw error
      setProject(data)
    } catch (error) {
      console.error("[v0] Error loading project:", error)
    }
  }

  const deleteRole = async (roleId: string) => {
    if (!confirm("האם למחוק תפקיד זה? כל השחקנים המשויכים יישארו בפרויקט بدون תפקיד.")) return

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("project_roles").delete().eq("id", roleId)

      if (error) throw error
      refreshAll()
    } catch (error) {
      console.error("[v0] Error deleting role:", error)
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
      console.error("[v0] Error removing actor:", error)
      alert("שגיאה בהסרת שחקן")
    }
  }

  async function deleteProject() {
    if (!confirm("האם אתה בטוח שברצונך למחוק את הפרויקט? פעולה זו בלתי הפיכה.")) return

    try {
      const supabase = createBrowserClient()
      await supabase.from("project_actors").delete().eq("project_id", params.id)
      await supabase.from("project_roles").delete().eq("project_id", params.id)
      const { error } = await supabase.from("casting_projects").delete().eq("id", params.id)

      if (error) throw error
      router.push("/projects")
    } catch (error) {
      console.error("[v0] Error deleting project:", error)
      alert("שגיאה במחיקת פרויקט")
    }
  }

  const getActorsByRole = (roleId: string | null) => {
    if (roleId === null) {
      return projectActors.filter((pa) => !pa.role_id)
    }
    return projectActors.filter((pa) => pa.role_id === roleId)
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
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="roles">תפקידים ({projectRoles.length})</TabsTrigger>
                <TabsTrigger value="actors">כל השחקנים ({projectActors.length})</TabsTrigger>
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

                                return (
                                  <div key={pa.id} className="p-4 flex items-center gap-4">
                                    <Link
                                      href={`/actors/${actor.id}`}
                                      className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0 hover:opacity-80 transition-opacity"
                                    >
                                      {actor.photo_url ? (
                                        <img
                                          src={actor.photo_url || "/placeholder.svg"}
                                          alt={actor.full_name}
                                          className="w-full h-full object-cover"
                                        />
                                      ) : (
                                        <div
                                          className={`w-full h-full flex items-center justify-center text-lg ${
                                            actor.gender === "זכר"
                                              ? "bg-blue-100 text-blue-600"
                                              : "bg-pink-100 text-pink-600"
                                          }`}
                                        >
                                          {actor.gender === "זכר" ? "♂" : "♀"}
                                        </div>
                                      )}
                                    </Link>

                                    <div className="flex-1 min-w-0">
                                      <Link href={`/actors/${actor.id}`} className="hover:underline">
                                        <p className="font-medium">{actor.full_name}</p>
                                      </Link>
                                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                        <span>{actor.gender}</span>
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
                                          הסר מהתפקיד
                                        </DropdownMenuItem>
                                      </DropdownMenuContent>
                                    </DropdownMenu>
                                  </div>
                                )
                              })}
                            </div>
                          ) : (
                            <div className="p-8 text-center text-muted-foreground">
                              <p>אין עדיין שחקנים בתפקיד זה</p>
                            </div>
                          )}
                        </Card>
                      )
                    })}

                    {/* שחקנים ללא תפקיד */}
                    {getActorsByRole(null).length > 0 && (
                      <Card className="overflow-hidden">
                        <div className="p-4 bg-muted/50">
                          <h4 className="font-semibold text-muted-foreground">שחקנים ללא תפקיד מוגדר</h4>
                        </div>
                        <div className="divide-y">
                          {getActorsByRole(null).map((pa) => {
                            const actor = pa.actors
                            return (
                              <div key={pa.id} className="p-4 flex items-center gap-4">
                                <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted">
                                  {actor.photo_url ? (
                                    <img
                                      src={actor.photo_url || "/placeholder.svg"}
                                      alt={actor.full_name}
                                      className="w-full h-full object-cover"
                                    />
                                  ) : (
                                    <div
                                      className={`w-full h-full flex items-center justify-center ${actor.gender === "זכר" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"}`}
                                    >
                                      {actor.gender === "זכר" ? "♂" : "♀"}
                                    </div>
                                  )}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium">{actor.full_name}</p>
                                  <p className="text-sm text-muted-foreground">{pa.role_name || "ללא תפקיד"}</p>
                                </div>
                                <Button variant="ghost" size="icon" onClick={() => removeActorFromProject(pa.id)}>
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            )
                          })}
                        </div>
                      </Card>
                    )}
                  </div>
                )}
              </TabsContent>

              {/* כל השחקנים */}
              <TabsContent value="actors" className="space-y-6 mt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-semibold">כל השחקנים בפרויקט</h3>
                    <p className="text-sm text-muted-foreground">{projectActors.length} שחקנים</p>
                  </div>
                  <Button onClick={() => setShowAddDialog(true)}>
                    <Plus className="h-4 w-4 ml-2" />
                    הוסף שחקן
                  </Button>
                </div>

                {projectActors.length === 0 ? (
                  <Card className="p-12 text-center">
                    <Users className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
                    <h3 className="text-lg font-semibold mb-2">אין עדיין שחקנים בפרויקט</h3>
                    <p className="text-muted-foreground mb-6">התחל על ידי הוספת שחקנים מתוך מאגר השחקנים</p>
                    <Button onClick={() => setShowAddDialog(true)}>
                      <Plus className="h-4 w-4 ml-2" />
                      הוסף שחקן ראשון
                    </Button>
                  </Card>
                ) : (
                  <div className="space-y-3">
                    {projectActors.map((pa) => {
                      const actor = pa.actors
                      const currentAge = actor.birth_year ? new Date().getFullYear() - actor.birth_year : null

                      return (
                        <Card key={pa.id} className="p-4">
                          <div className="flex items-center gap-4">
                            <Link
                              href={`/actors/${actor.id}`}
                              className="w-14 h-14 rounded-lg overflow-hidden bg-muted flex-shrink-0 hover:opacity-80 transition-opacity"
                            >
                              {actor.photo_url ? (
                                <img
                                  src={actor.photo_url || "/placeholder.svg"}
                                  alt={actor.full_name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <div
                                  className={`w-full h-full flex items-center justify-center text-xl ${actor.gender === "זכר" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"}`}
                                >
                                  {actor.gender === "זכר" ? "♂" : "♀"}
                                </div>
                              )}
                            </Link>

                            <div className="flex-1 min-w-0">
                              <Link href={`/actors/${actor.id}`} className="hover:underline">
                                <p className="font-medium">{actor.full_name}</p>
                              </Link>
                              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                                <span>{actor.gender}</span>
                                {currentAge && (
                                  <>
                                    <span>•</span>
                                    <span>גיל {currentAge}</span>
                                  </>
                                )}
                              </div>
                              <div className="mt-1 flex items-center gap-2 flex-wrap">
                                <Badge variant="outline" className="text-xs">
                                  {pa.role_name || "ללא תפקיד"}
                                </Badge>
                                {pa.replicas_planned && (
                                  <Badge variant="secondary" className="text-xs">
                                    {pa.replicas_planned} רפליקות
                                  </Badge>
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
                                  <Edit className="h-4 w-4 ml-2" />
                                  ערוך פרטים
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  className="text-destructive"
                                  onClick={() => removeActorFromProject(pa.id)}
                                >
                                  <Trash2 className="h-4 w-4 ml-2" />
                                  הסר מהפרויקט
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </Card>
                      )
                    })}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          </div>
        </div>
      </div>

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
        onActorUpdated={refreshAll}
      />

      <CreateRoleDialog
        open={showCreateRoleDialog}
        onOpenChange={setShowCreateRoleDialog}
        projectId={params.id}
        onRoleCreated={refreshAll}
      />

      <AddActorToProjectDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        projectId={params.id}
        roles={projectRoles}
        onActorsAdded={refreshAll}
      />
    </div>
  )
}
