"use client"

import { useState } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { createBrowserClient } from "@/lib/supabase/client"

interface CreateRoleDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  onRoleCreated: () => void
}

export function CreateRoleDialog({ open, onOpenChange, projectId, onRoleCreated }: CreateRoleDialogProps) {
  const { toast } = useToast()
  const [roleName, setRoleName] = useState("")
  const [description, setDescription] = useState("")
  const [replicasNeeded, setReplicasNeeded] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async () => {
    if (!roleName.trim()) {
      toast({ title: "שגיאה", description: "נא להזין שם תפקיד", variant: "destructive" })
      return
    }

    setIsLoading(true)
    try {
      const supabase = createBrowserClient()
      const { error } = await supabase.from("project_roles").insert({
        project_id: projectId,
        role_name: roleName.trim(),
        role_name_normalized: roleName.trim().toLowerCase(),
        description: description.trim() || null,
        replicas_needed: replicasNeeded ? Number.parseInt(replicasNeeded) : 0,
      })

      if (error) throw error

      // Reset form
      setRoleName("")
      setDescription("")
      setReplicasNeeded("")
      onOpenChange(false)
      onRoleCreated()
    } catch (error) {
      console.error("[v0] Error creating role:", error)
      toast({ title: "שגיאה", description: "שגיאה ביצירת תפקיד", variant: "destructive" })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle>תפקיד חדש</DialogTitle>
          <DialogDescription>הוסף תפקיד חדש לפרויקט</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="roleName">שם התפקיד *</Label>
            <Input
              id="roleName"
              value={roleName}
              onChange={(e) => setRoleName(e.target.value)}
              placeholder="לדוגמה: גיבור ראשי, דמות משנה"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">תיאור התפקיד</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="תיאור קצר של התפקיד..."
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="replicasNeeded">מספר רפליקות משוער</Label>
            <Input
              id="replicasNeeded"
              type="number"
              min="0"
              value={replicasNeeded}
              onChange={(e) => setReplicasNeeded(e.target.value)}
              placeholder="0"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            ביטול
          </Button>
          <Button onClick={handleSubmit} disabled={isLoading}>
            {isLoading ? "יוצר..." : "צור תפקיד"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
