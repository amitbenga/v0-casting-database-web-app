"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import { useToast } from "@/hooks/use-toast"

interface CreateProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onProjectCreated?: () => void
}

export function CreateProjectDialog({ open, onOpenChange, onProjectCreated }: CreateProjectDialogProps) {
  const { toast } = useToast()
  const [formData, setFormData] = useState({
    name: "",
    director: "",
    casting_director: "",
    project_date: "",
    notes: "",
    status: "not_started",
  })
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("casting_projects")
        .insert([
          {
            name: formData.name,
            director: formData.director || null,
            casting_director: formData.casting_director || null,
            project_date: formData.project_date || null,
            status: formData.status,
            notes: formData.notes,
          },
        ])
        .select()

      if (error) {
        console.error("[v0] Error creating project:", error)
        toast({ title: "שגיאה", description: "שגיאה ביצירת הפרויקט", variant: "destructive" })
        return
      }

      console.log("[v0] Project created:", data)
      onOpenChange(false)
      setFormData({ name: "", director: "", casting_director: "", project_date: "", notes: "", status: "not_started" })

      if (onProjectCreated) {
        onProjectCreated()
      }
    } catch (error) {
      console.error("[v0] Error:", error)
      toast({ title: "שגיאה", description: "שגיאה ביצירת הפרויקט", variant: "destructive" })
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>יצירת פרויקט חדש</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2 col-span-2">
              <Label htmlFor="name">שם הפרויקט *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="לדוגמה: קמפיין קיץ 2025"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="director">במאי</Label>
              <Input
                id="director"
                value={formData.director}
                onChange={(e) => setFormData({ ...formData, director: e.target.value })}
                placeholder="שם הבמאי"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="casting_director">מלהק</Label>
              <Input
                id="casting_director"
                value={formData.casting_director}
                onChange={(e) => setFormData({ ...formData, casting_director: e.target.value })}
                placeholder="שם המלהק"
              />
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="project_date">תאריך הפרויקט</Label>
              <Input
                id="project_date"
                type="date"
                value={formData.project_date}
                onChange={(e) => setFormData({ ...formData, project_date: e.target.value })}
                min={new Date().toISOString().split("T")[0]}
                max="2030-12-31"
                className="text-right"
                dir="rtl"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="status">סטטוס</Label>
            <Select value={formData.status} onValueChange={(value) => setFormData({ ...formData, status: value })}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_started">לא התחיל</SelectItem>
                <SelectItem value="casting">בליהוק</SelectItem>
                <SelectItem value="voice_testing">בדיקת קולות</SelectItem>
                <SelectItem value="casted">ליהוק הושלם</SelectItem>
                <SelectItem value="recording">בהקלטה</SelectItem>
                <SelectItem value="completed">הושלם</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="תאר את הפרויקט, דרישות ופרטים חשובים..."
              className="min-h-[100px]"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              ביטול
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "שומר..." : "צור פרויקט"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
