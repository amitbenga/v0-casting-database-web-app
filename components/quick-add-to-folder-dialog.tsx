"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { createBrowserClient } from "@/lib/supabase/client"
import type { Actor } from "@/lib/types"

interface QuickAddToFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actor: Actor | null
  onSuccess?: () => void
}

export function QuickAddToFolderDialog({ open, onOpenChange, actor, onSuccess }: QuickAddToFolderDialogProps) {
  const [folders, setFolders] = useState<any[]>([])
  const [selectedFolderId, setSelectedFolderId] = useState<string>("")
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadFolders()
    }
  }, [open])

  async function loadFolders() {
    try {
      const supabase = createBrowserClient()
      const { data, error } = await supabase.from("folders").select("*").order("name")

      if (error) throw error
      setFolders(data || [])
      if (data && data.length > 0) {
        setSelectedFolderId(data[0].id)
      }
    } catch (error) {
      console.error("[v0] Error loading folders:", error)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!actor || !selectedFolderId) {
      alert("יש לבחור תיקייה")
      return
    }

    setLoading(true)
    try {
      const supabase = createBrowserClient()

      // Check if already exists
      const { data: existing } = await supabase
        .from("folder_actors")
        .select("*")
        .eq("folder_id", selectedFolderId)
        .eq("actor_id", actor.id)
        .single()

      if (existing) {
        alert("השחקן כבר נמצא בתיקייה זו")
        setLoading(false)
        return
      }

      const { error } = await supabase.from("folder_actors").insert({
        folder_id: selectedFolderId,
        actor_id: actor.id,
      })

      if (error) throw error

      onSuccess?.()
      onOpenChange(false)
    } catch (error) {
      console.error("[v0] Error adding actor to folder:", error)
      alert("שגיאה בהוספת שחקן לתיקייה: " + (error as any).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף שחקן לתיקייה</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>שחקן</Label>
            <Input value={actor?.full_name || ""} disabled />
          </div>

          <div className="space-y-2">
            <Label htmlFor="folder">תיקייה *</Label>
            <Select value={selectedFolderId} onValueChange={setSelectedFolderId}>
              <SelectTrigger>
                <SelectValue placeholder="בחר תיקייה" />
              </SelectTrigger>
              <SelectContent>
                {folders.map((folder) => (
                  <SelectItem key={folder.id} value={folder.id}>
                    {folder.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={loading || !selectedFolderId}>
              {loading ? "מוסיף..." : "הוסף לתיקייה"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
