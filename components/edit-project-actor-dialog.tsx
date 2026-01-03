"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { createBrowserClient } from "@/lib/supabase/client"

interface EditProjectActorDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectActor: any
  onActorUpdated: () => void
}

export function EditProjectActorDialog({
  open,
  onOpenChange,
  projectActor,
  onActorUpdated,
}: EditProjectActorDialogProps) {
  const [formData, setFormData] = useState({
    role_name: "",
    replicas_planned: "",
    replicas_final: "",
    notes: "",
  })
  const [loading, setLoading] = useState(false)

  const actorId = projectActor?.id
  useEffect(() => {
    if (open && projectActor) {
      setFormData({
        role_name: projectActor.role_name || "",
        replicas_planned: projectActor.replicas_planned?.toString() || "",
        replicas_final: projectActor.replicas_final?.toString() || "",
        notes: projectActor.notes || "",
      })
    }
  }, [open, actorId]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createBrowserClient()
      const { error } = await supabase
        .from("project_actors")
        .update({
          role_name: formData.role_name,
          replicas_planned: formData.replicas_planned ? Number.parseInt(formData.replicas_planned) : null,
          replicas_final: formData.replicas_final ? Number.parseInt(formData.replicas_final) : null,
          notes: formData.notes || null,
        })
        .eq("id", projectActor.id)

      if (error) throw error

      onActorUpdated()
      onOpenChange(false)
    } catch (error) {
      console.error("Error updating project actor:", error)
      alert("שגיאה בעדכון פרטי שחקן")
    } finally {
      setLoading(false)
    }
  }

  if (!projectActor) return null

  const actor = projectActor.actors

  const getGenderStyle = (gender: string) => {
    if (gender === "male") {
      return { bg: "bg-blue-100", text: "text-blue-600", symbol: "♂" }
    } else if (gender === "female") {
      return { bg: "bg-pink-100", text: "text-pink-600", symbol: "♀" }
    }
    return { bg: "bg-gray-100", text: "text-gray-600", symbol: "?" }
  }

  const genderStyle = getGenderStyle(actor?.gender)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>ערוך פרטי שחקן בפרויקט</DialogTitle>
        </DialogHeader>

        <div className="mb-4 flex items-center gap-3 p-3 bg-muted rounded-lg">
          <div className="w-12 h-12 rounded-lg overflow-hidden bg-background flex-shrink-0">
            {actor?.image_url ? (
              <img
                src={actor.image_url || "/placeholder.svg"}
                alt={actor.full_name}
                className="w-full h-full object-cover"
              />
            ) : (
              <div
                className={`w-full h-full flex items-center justify-center text-xl ${genderStyle.bg} ${genderStyle.text}`}
              >
                {genderStyle.symbol}
              </div>
            )}
          </div>
          <div>
            <p className="font-medium">{actor?.full_name}</p>
            <p className="text-sm text-muted-foreground">
              {actor?.gender === "male" ? "זכר" : actor?.gender === "female" ? "נקבה" : actor?.gender}
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="role_name">שם התפקיד</Label>
            <Input
              id="role_name"
              value={formData.role_name}
              onChange={(e) => setFormData({ ...formData, role_name: e.target.value })}
              placeholder="למשל: דמות ראשית, קריין"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="replicas_planned">רפליקות מתוכננות</Label>
              <Input
                id="replicas_planned"
                type="number"
                min="0"
                value={formData.replicas_planned}
                onChange={(e) => setFormData({ ...formData, replicas_planned: e.target.value })}
                placeholder="0"
                dir="ltr"
                className="text-right"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="replicas_final">רפליקות סופיות</Label>
              <Input
                id="replicas_final"
                type="number"
                min="0"
                value={formData.replicas_final}
                onChange={(e) => setFormData({ ...formData, replicas_final: e.target.value })}
                placeholder="0"
                dir="ltr"
                className="text-right"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות</Label>
            <Textarea
              id="notes"
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="הערות נוספות על תפקיד השחקן בפרויקט..."
              className="min-h-[80px]"
            />
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
