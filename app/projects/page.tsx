"use client"

import { useState, useMemo } from "react"
import useSWR from "swr"
import { Plus, Search, Calendar, Users, MoreVertical, UserCircle, Film, Clapperboard, FileText } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { CreateProjectDialog } from "@/components/create-project-dialog"
import { EditProjectDialog } from "@/components/edit-project-dialog"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"
import { useDebounce } from "@/hooks/use-debounce"
import { swrKeys } from "@/lib/swr-keys"
import { ProtectedRoute } from "@/components/ProtectedRoute"

const STATUS_COLORS: Record<string, string> = {
  not_started: "bg-gray-500/10 text-gray-500 border-gray-500/20",
  casting: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  voice_testing: "bg-cyan-500/10 text-cyan-500 border-cyan-500/20",
  casted: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  recording: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  completed: "bg-green-500/10 text-green-500 border-green-500/20",
}

const STATUS_LABELS: Record<string, string> = {
  not_started: "לא התחיל",
  casting: "בליהוק",
  voice_testing: "בדיקת קולות",
  casted: "ליהוק הושלם",
  recording: "בהקלטה",
  completed: "הושלם",
}

function getStatusColor(status: string) {
  return STATUS_COLORS[status] ?? "bg-gray-500/10 text-gray-500 border-gray-500/20"
}

function getStatusLabel(status: string) {
  return STATUS_LABELS[status] ?? status
}

async function fetchProjects() {
  const supabase = createClient()
  // project_summary view (migration 006) joins casting_projects + role_castings + project_scripts + script_lines
  // in one round-trip, replacing 4 separate count queries.
  const { data, error } = await supabase
    .from("project_summary")
    .select("*")
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[v0] Error loading projects:", error)
    throw error
  }

  return data || []
}

function ProjectsPageContent() {
  const { toast } = useToast()
  const { data: projects = [], isLoading: loading, mutate } = useSWR(swrKeys.projects.list(), fetchProjects)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [selectedProject, setSelectedProject] = useState<any | null>(null)
  const [statusFilter, setStatusFilter] = useState<string>("all")
  const debouncedSearch = useDebounce(searchQuery, 300)

  const filteredProjects = useMemo(() => {
    const query = debouncedSearch.toLowerCase()
    return projects.filter((project) => {
      const matchesSearch =
        !query ||
        project.name.toLowerCase().includes(query) ||
        (project.notes && project.notes.toLowerCase().includes(query))
      const matchesStatus = statusFilter === "all" || project.status === statusFilter
      return matchesSearch && matchesStatus
    })
  }, [projects, debouncedSearch, statusFilter])

  const handleEditProject = (project: any) => {
    setSelectedProject(project)
    setShowEditDialog(true)
  }

  const handleDuplicateProject = async (project: any) => {
    try {
      const supabase = createClient()
      const { data: newProject, error } = await supabase
        .from("casting_projects")
        .insert({
          name: `${project.name} (עותק)`,
          director: project.director,
          casting_director: project.casting_director,
          project_date: project.project_date,
          status: "not_started",
          notes: project.notes,
        })
        .select("id,name,status,notes,director,casting_director,project_date,created_at")
        .single()

      if (error) {
        console.error("[v0] Error duplicating project:", error)
        toast({ title: "שגיאה", description: "שגיאה בשכפול פרויקט", variant: "destructive" })
        return
      }

      toast({ title: "הצלחה", description: "הפרויקט שוכפל בהצלחה" })
      if (newProject) {
        mutate([newProject, ...projects], false)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
      toast({ title: "שגיאה", description: "שגיאה בשכפול פרויקט", variant: "destructive" })
    }
  }

  const handleExportProject = async (project: any) => {
    toast({ title: "בקרוב", description: "ייצוא פרויקט יהיה זמין בקרוב" })
  }

  const handleDeleteProject = async (id: string) => {
    if (confirm("האם אתה בטוח שברצונך למחוק פרויקט זה?")) {
      const previousData = projects
      // Optimistic update — remove from cache immediately
      mutate(
        previousData.filter((p: any) => p.id !== id),
        false, // Don't revalidate yet
      )
      try {
        const supabase = createClient()
        const { error } = await supabase.from("casting_projects").delete().eq("id", id)

        if (error) {
          console.error("[v0] Error deleting project:", error)
          // Rollback on failure
          mutate(previousData, false)
          toast({ title: "שגיאה", description: "שגיאה במחיקת פרויקט", variant: "destructive" })
        }
      } catch (error) {
        console.error("[v0] Error:", error)
        // Rollback on failure
        mutate(previousData, false)
        toast({ title: "שגיאה", description: "שגיאה במחיקת פרויקט", variant: "destructive" })
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="container mx-auto px-4 md:px-6 py-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-lg border bg-card p-5 space-y-3 animate-pulse">
                <div className="h-5 w-32 bg-muted rounded" />
                <div className="h-5 w-16 bg-muted rounded-full" />
                <div className="h-3 w-24 bg-muted rounded" />
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Filter Bar */}
      <div className="border-b bg-card">
        <div className="container mx-auto px-4 md:px-6 py-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 overflow-x-auto w-full md:w-auto">
              <Button
                variant={statusFilter === "all" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("all")}
                className="text-xs md:text-sm"
              >
                הכל
              </Button>
              <Button
                variant={statusFilter === "not_started" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("not_started")}
                className="text-xs md:text-sm"
              >
                לא התחיל
              </Button>
              <Button
                variant={statusFilter === "casting" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("casting")}
                className="text-xs md:text-sm"
              >
                בליהוק
              </Button>
              <Button
                variant={statusFilter === "voice_testing" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("voice_testing")}
                className="text-xs md:text-sm"
              >
                בדיקת קולות
              </Button>
              <Button
                variant={statusFilter === "casted" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("casted")}
                className="text-xs md:text-sm"
              >
                ליהוק הושלם
              </Button>
              <Button
                variant={statusFilter === "recording" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("recording")}
                className="text-xs md:text-sm"
              >
                בהקלטה
              </Button>
              <Button
                variant={statusFilter === "completed" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
                className="text-xs md:text-sm"
              >
                הושלם
              </Button>
            </div>

            <div className="flex items-center gap-3 w-full md:w-auto">
              <div className="relative flex-1 md:w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  type="search"
                  placeholder="חיפוש פרויקטים..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-9"
                />
              </div>

              <Button onClick={() => setShowCreateDialog(true)} size="sm" className="md:size-default">
                <Plus className="h-4 w-4 ml-2" />
                <span className="hidden md:inline">פרויקט חדש</span>
              </Button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-6 md:py-8">
        {/* Projects Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
          {filteredProjects.map((project) => (
            <Card key={project.id} className="p-4 md:p-6 hover:shadow-lg transition-shadow">
              <div className="space-y-3 md:space-y-4">
                {/* Header */}
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <Link href={`/projects/${project.id}`}>
                      <h3 className="font-semibold text-base md:text-lg hover:text-primary transition-colors">
                        {project.name}
                      </h3>
                    </Link>
                    {project.notes && (
                      <p className="text-xs md:text-sm text-muted-foreground mt-1 line-clamp-2">{project.notes}</p>
                    )}
                  </div>

                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Link href={`/projects/${project.id}`}>צפייה בפרטים</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          handleEditProject(project)
                        }}
                      >
                        עריכת פרויקט
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          handleDuplicateProject(project)
                        }}
                      >
                        שכפול
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={(e) => {
                          e.preventDefault()
                          handleExportProject(project)
                        }}
                      >
                        ייצוא
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={(e) => {
                          e.preventDefault()
                          handleDeleteProject(project.id)
                        }}
                      >
                        מחיקה
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                {/* Status Badge */}
                <Badge variant="outline" className={getStatusColor(project.status)}>
                  {getStatusLabel(project.status)}
                </Badge>

                {/* Project Info */}
                <div className="space-y-2 pt-2">
                  {project.casting_director && (
                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <UserCircle className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">מלהק:</span>
                      <span className="font-medium">{project.casting_director}</span>
                    </div>
                  )}
                  {project.director && (
                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <Film className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">במאי:</span>
                      <span className="font-medium">{project.director}</span>
                    </div>
                  )}
                  {project.project_date && (
                    <div className="flex items-center gap-2 text-xs md:text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">תאריך:</span>
                      <span className="font-medium">{new Date(project.project_date).toLocaleDateString("he-IL")}</span>
                    </div>
                  )}
                </div>

                {/* Stats row from project_summary view */}
                <div className="flex items-center gap-3 pt-1 border-t text-xs text-muted-foreground">
                  <div className="flex items-center gap-1" title="תפקידים / שובצו">
                    <Users className="h-3.5 w-3.5" />
                    <span>
                      {project.actors_cast ?? 0}/{project.roles_count ?? 0}
                    </span>
                  </div>
                  <div className="flex items-center gap-1" title="תסריטים">
                    <FileText className="h-3.5 w-3.5" />
                    <span>{project.scripts_count ?? 0}</span>
                  </div>
                  {(project.total_lines ?? 0) > 0 && (
                    <div className="flex items-center gap-1" title="שורות / הוקלטו">
                      <Clapperboard className="h-3.5 w-3.5" />
                      <span>
                        {project.recorded_lines ?? 0}/{project.total_lines ?? 0}
                      </span>
                    </div>
                  )}
                  <span className="mr-auto">
                    {new Date(project.created_at).toLocaleDateString("he-IL")}
                  </span>
                </div>
              </div>
            </Card>
          ))}
        </div>

        {filteredProjects.length === 0 && (
          <div className="text-center py-12">
            <p className="text-muted-foreground">לא נמצאו פרויקטים התואמים לחיפוש.</p>
          </div>
        )}
      </div>

      <CreateProjectDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onProjectCreated={() => mutate()} />

      {selectedProject && (
        <EditProjectDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          project={selectedProject}
          onProjectUpdated={() => {
            mutate()
            setShowEditDialog(false)
            setSelectedProject(null)
          }}
        />
      )}
    </div>
  )
}

export default function ProjectsPage() {
  return (
    <ProtectedRoute>
      <ProjectsPageContent />
    </ProtectedRoute>
  )
}
