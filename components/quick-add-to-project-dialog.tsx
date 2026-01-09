"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Actor } from "@/lib/types"

interface QuickAddToProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actor: Actor | null
  onSuccess?: () => void
}

export function QuickAddToProjectDialog({ open, onOpenChange, actor, onSuccess }: QuickAddToProjectDialogProps) {
  const [projects, setProjects] = useState<any[]>([])
  const [selectedProjectId, setSelectedProjectId] = useState<string>("")
  const [roleName, setRoleName] = useState("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadProjects()
    }
  }, [open])

  async function loadProjects() {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase
        .from("casting_projects")
        .select("*")
        .order("created_at", { ascending: false })

      if (error) throw error
      setProjects(data || [])
      if (data && data.length > 0) {
        setSelectedProjectId(data[0].id)
      }
    } catch (error) {
      console.error("[v0] Error loading projects:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actor || !selectedProjectId || !roleName.trim()) {
      alert("יש למלא את כל השדות")
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserClient()

      const { error } = await supabase.from("project_actors").insert({
        project_id: selectedProjectId,
        actor_id: actor.id,
        role_name: roleName.trim(),
        replicas_planned: 0,
        replicas_final: 0,
        notes: "",
      })

      if (error) throw error

      onSuccess?.()
      onOpenChange(false)
      setRoleName("")
    } catch (error) {
      console.error("[v0] Error adding actor to project:", error)
      alert("שגיאה בהוספת שחקן לפרויקט: " + (error as any).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף שחקן לפרויקט</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>שחקן</Label>
            <Input value={actor?.full_name || ""} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="project">פרויקט *</Label>
            <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר פרויקט" />
              </SelectTrigger>
              <SelectContent>
                {projects.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="roleName">שם התפקיד *</Label>
            <Input
              id="roleName"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="למשל: דמות ראשית, קריין..."
              required
            />
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading || !selectedProjectId || !roleName.trim()}>
              {loading ? "מוסיף..." : "הוסף לפרויקט"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
