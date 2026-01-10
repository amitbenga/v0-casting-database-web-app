"use client"

import type React from "react"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { createClient } from "@/lib/supabase/client"

interface CreateFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onFolderCreated?: () => void
}

export function CreateFolderDialog({ open, onOpenChange, onFolderCreated }: CreateFolderDialogProps) {
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    color: "blue",
  })
  const [submitting, setSubmitting] = useState(false)

  const colors = [
    { value: "blue", class: "bg-blue-500" },
    { value: "green", class: "bg-green-500" },
    { value: "purple", class: "bg-purple-500" },
    { value: "pink", class: "bg-pink-500" },
    { value: "orange", class: "bg-orange-500" },
    { value: "red", class: "bg-red-500" },
  ]

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSubmitting(true)

    try {
      const supabase = createClient()
      const { data, error } = await supabase
        .from("folders")
        .insert([
          {
            name: formData.name,
            description: formData.description || null,
            color: formData.color,
          },
        ])
        .select()

      if (error) {
        console.error("[v0] Error creating folder:", error)
        alert("שגיאה ביצירת התיקייה")
        return
      }

      console.log("[v0] Folder created:", data)
      onOpenChange(false)
      setFormData({ name: "", description: "", color: "blue" })

      if (onFolderCreated) {
        onFolderCreated()
      }
    } catch (error) {
      console.error("[v0] Error:", error)
      alert("שגיאה ביצירת התיקייה")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>יצירת תיקייה חדשה</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">שם התיקייה</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="לדוגמה: שחקנים ספורטיביים"
              required
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור (אופציונלי)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="תיאור קצר של התיקייה..."
              rows={3}
              dir="rtl"
            />
          </div>

          <div className="space-y-3">
            <Label>צבע התיקייה</Label>
            <RadioGroup value={formData.color} onValueChange={(value) => setFormData({ ...formData, color: value })}>
              <div className="flex gap-3">
                {colors.map((color) => (
                  <div key={color.value} className="flex items-center">
                    <RadioGroupItem value={color.value} id={color.value} className="sr-only" />
                    <Label
                      htmlFor={color.value}
                      className={`w-10 h-10 rounded-full cursor-pointer ${color.class} ${
                        formData.color === color.value ? "ring-2 ring-offset-2 ring-primary" : "opacity-60"
                      } hover:opacity-100 transition-opacity`}
                    />
                  </div>
                ))}
              </div>
            </RadioGroup>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={submitting}>
              ביטול
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? "שומר..." : "צור תיקייה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
