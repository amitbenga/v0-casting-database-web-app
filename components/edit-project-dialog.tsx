"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"

interface EditProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  project: any
  onProjectUpdated: () => void
}

export function EditProjectDialog({ open, onOpenChange, project, onProjectUpdated }: EditProjectDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    director: "",
    casting_director: "",
    project_date: "",
    status: "not_started",
    notes: "",
  })
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (project) {
      setFormData({
        name: project.name || "",
        director: project.director || "",
        casting_director: project.casting_director || "",
        project_date: project.project_date || "",
        status: project.status || "not_started",
        notes: project.notes || "",
      })
    }
  }, [project])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from("casting_projects")
        .update({
          name: formData.name,
          director: formData.director || null,
          casting_director: formData.casting_director || null,
          project_date: formData.project_date || null,
          status: formData.status,
          notes: formData.notes || null,
        })
        .eq("id", project.id)

      if (error) throw error

      onProjectUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error updating project:", error)
      alert("שגיאה בעדכון פרויקט")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>ערוך פרויקט</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">שם הפרויקט *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="שם הפרויקט"
                required
                dir="rtl"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="director">במאי</Label>
                <Input
                  id="director"
                  value={formData.director}
                  onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                  placeholder="שם הבמאי"
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="casting_director">מלהק</Label>
                <Input
                  id="casting_director"
                  value={formData.casting_director}
                  onChange={(e) => setFormData({ ...formData, casting_director: e.target.value })}
                  placeholder="שם המלהק"
                  dir="rtl"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="project_date">תאריך פרויקט</Label>
                <Input
                  id="project_date"
                  type="date"
                  value={formData.project_date}
                  onChange={(e) => setFormData({ ...formData, project_date: e.target.value })}
                  max="2100-12-31"
                  dir="ltr"
                  className="text-right"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="status">סטטוס</Label>
                <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
                  <SelectTrigger dir="rtl">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="not_started">לא התחיל</SelectItem>
                    <SelectItem value="casting">בליהוק</SelectItem>
                    <SelectItem value="casted">ליהוק הושלם</SelectItem>
                    <SelectItem value="recording">בהקלטה</SelectItem>
                    <SelectItem value="completed">הושלם</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">הערות</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                placeholder="הערות על הפרויקט..."
                className="min-h-[100px]"
                dir="rtl"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? "שומר..." : "שמור שינויים"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
