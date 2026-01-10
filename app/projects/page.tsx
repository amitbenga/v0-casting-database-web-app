"use client"

import { useState, useEffect } from "react"
import { Plus, Search, Calendar, Users, MoreVertical, FolderOpen } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import Link from "next/link"
import { CreateProjectDialog } from "@/components/create-project-dialog"
import { AppHeader } from "@/components/app-header"
import { createClient } from "@/lib/supabase/client"

export default function ProjectsPage() {
  const [projects, setProjects] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [statusFilter, setStatusFilter] = useState<string>("all")

  useEffect(() => {
    loadProjects()
  }, [])

  async function loadProjects() {
    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("casting_projects")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) {
        console.error("[v0] Error loading projects:", error)
        return
      }

      if (data) {
        setProjects(data)
      }
    } catch (error) {
      console.error("[v0] Error:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredProjects = projects.filter((project) => {
    const matchesSearch =
      project.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (project.notes && project.notes.toLowerCase().includes(searchQuery.toLowerCase()))

    const matchesStatus = statusFilter === "all" || project.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500/10 text-green-500 border-green-500/20"
      case "completed":
        return "bg-blue-500/10 text-blue-500 border-blue-500/20"
      case "draft":
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
      default:
        return "bg-gray-500/10 text-gray-500 border-gray-500/20"
    }
  }

  const handleDeleteProject = async (id: string) => {
    if (confirm("האם אתה בטוח שברצונך למחוק פרויקט זה?")) {
      try {
        const supabase = createClient()
        const { error } = await supabase.from("casting_projects").delete().eq("id", id)

        if (error) {
          console.error("[v0] Error deleting project:", error)
          return
        }

        await loadProjects()
      } catch (error) {
        console.error("[v0] Error:", error)
      }
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <div className="flex items-center justify-center h-[60vh]">
          <p className="text-muted-foreground">טוען פרויקטים...</p>
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
                className="text-xs md:text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                הכל
              </Button>
              <Button
                variant={statusFilter === "active" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("active")}
                className="text-xs md:text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                פעיל
              </Button>
              <Button
                variant={statusFilter === "draft" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("draft")}
                className="text-xs md:text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
              >
                טיוטה
              </Button>
              <Button
                variant={statusFilter === "completed" ? "default" : "ghost"}
                size="sm"
                onClick={() => setStatusFilter("completed")}
                className="text-xs md:text-sm hover:bg-accent hover:text-accent-foreground transition-colors"
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
                      <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-accent hover:text-accent-foreground transition-colors">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" dir="rtl">
                      <DropdownMenuItem asChild className="cursor-pointer hover:bg-accent focus:bg-accent">
                        <Link href={`/projects/${project.id}`} className="w-full">צפייה בפרטים</Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent">עריכת פרויקט</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent">שכפול</DropdownMenuItem>
                      <DropdownMenuItem className="cursor-pointer hover:bg-accent focus:bg-accent">ייצוא</DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive cursor-pointer hover:bg-destructive/10 focus:bg-destructive/10 focus:text-destructive"
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
                  {project.status === "active" && "פעיל"}
                  {project.status === "completed" && "הושלם"}
                  {project.status === "draft" && "טיוטה"}
                </Badge>

                {/* Casting Director */}
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">במאי ליהוק</p>
                  <p className="text-sm font-medium">{project.castingDirector}</p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                  <div className="flex items-center gap-2">
                    <FolderOpen className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">תפקידים</p>
                      <p className="text-sm font-medium">{project.numberOfRoles}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-xs text-muted-foreground">שחקנים</p>
                      <p className="text-sm font-medium">{project.numberOfActors}</p>
                    </div>
                  </div>
                </div>

                {/* Deadline */}
                <div className="flex items-center gap-2 text-xs md:text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="text-muted-foreground">תאריך יעד:</span>
                  <span className="font-medium">{new Date(project.deadline).toLocaleDateString("he-IL")}</span>
                </div>

                {/* Created At */}
                <div className="text-xs text-muted-foreground">
                  נוצר {new Date(project.created_at).toLocaleDateString("he-IL")}
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

      <CreateProjectDialog open={showCreateDialog} onOpenChange={setShowCreateDialog} onProjectCreated={loadProjects} />
    </div>
  )
}
