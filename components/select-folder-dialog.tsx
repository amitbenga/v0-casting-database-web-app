"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { FolderPlus, Folder } from "lucide-react"
import { Card } from "@/components/ui/card"
import { createClient } from "@/lib/supabase/client"

interface SelectFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  actorIds: string[]
  actorNames: string[]
  onSuccess?: () => void // Added optional onSuccess callback
}

interface FolderType {
  id: string
  name: string
  color: string
  created_at: string
}

export function SelectFolderDialog({ open, onOpenChange, actorIds, actorNames, onSuccess }: SelectFolderDialogProps) {
  const [folders, setFolders] = useState<FolderType[]>([])
  const [loading, setLoading] = useState(false)
  const [showCreateNew, setShowCreateNew] = useState(false)
  const [newFolderName, setNewFolderName] = useState("")
  const [newFolderColor, setNewFolderColor] = useState("blue")

  const colors = [
    { name: "כחול", value: "blue", class: "bg-blue-500" },
    { name: "ירוק", value: "green", class: "bg-green-500" },
    { name: "אדום", value: "red", class: "bg-red-500" },
    { name: "צהוב", value: "yellow", class: "bg-yellow-500" },
    { name: "סגול", value: "purple", class: "bg-purple-500" },
    { name: "ורוד", value: "pink", class: "bg-pink-500" },
    { name: "כתום", value: "orange", class: "bg-orange-500" },
  ]

  useEffect(() => {
    if (open) {
      loadFolders()
    }
  }, [open])

  async function loadFolders() {
    try {
      setLoading(true)
      const supabase = createClient()

      const { data, error } = await supabase.from("folders").select("*").order("created_at", { ascending: false })

      if (error) throw error

      setFolders(data || [])
    } catch (error) {
      console.error("[v0] Error loading folders:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreateAndAdd = async () => {
    if (!newFolderName.trim()) {
      alert("נא להזין שם לתיקייה")
      return
    }

    try {
      setLoading(true)
      const supabase = createClient()

      const { data: newFolder, error: folderError } = await supabase
        .from("folders")
        .insert({ name: newFolderName.trim(), color: newFolderColor })
        .select()
        .single()

      if (folderError) throw folderError

      await addActorsToFolder(newFolder.id)

      onOpenChange(false)
      setNewFolderName("")
      setNewFolderColor("blue")
      setShowCreateNew(false)
      onSuccess?.() // Call onSuccess after adding
    } catch (error) {
      console.error("[v0] Error creating folder:", error)
      alert("שגיאה ביצירת התיקייה")
    } finally {
      setLoading(false)
    }
  }

  const addActorsToFolder = async (folderId: string) => {
    try {
      const supabase = createClient()

      const { data: existing } = await supabase
        .from("folder_actors")
        .select("actor_id")
        .eq("folder_id", folderId)
        .in("actor_id", actorIds)

      const existingIds = new Set(existing?.map((e) => e.actor_id) || [])
      const newActorIds = actorIds.filter((id) => !existingIds.has(id))

      if (newActorIds.length === 0) {
        alert("השחקן/ים כבר בתיקייה זו")
        return
      }

      const folderActors = newActorIds.map((actorId) => ({
        folder_id: folderId,
        actor_id: actorId,
      }))

      const { error } = await supabase.from("folder_actors").insert(folderActors)

      if (error) throw error

      alert(`${newActorIds.length} שחקנים נוספו בהצלחה!`)
    } catch (error) {
      console.error("[v0] Error adding actors to folder:", error)
      throw error
    }
  }

  const handleSelectFolder = async (folderId: string) => {
    try {
      setLoading(true)
      await addActorsToFolder(folderId)
      onOpenChange(false)
      onSuccess?.() // Call onSuccess after adding
    } catch (error) {
      alert("שגיאה בהוספת השחקנים לתיקייה")
    } finally {
      setLoading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף ל{actorNames.length === 1 ? "תיקייה" : ` ${actorNames.length} תיקיות`}</DialogTitle>
          <p className="text-sm text-muted-foreground">
            {actorNames.length === 1 ? actorNames[0] : `${actorNames.length} שחקנים`}
          </p>
        </DialogHeader>

        <div className="space-y-4">
          {!showCreateNew ? (
            <>
              <Button
                variant="outline"
                className="w-full justify-start bg-transparent"
                onClick={() => setShowCreateNew(true)}
                disabled={loading}
              >
                <FolderPlus className="ml-2 h-4 w-4" />
                צור תיקייה חדשה
              </Button>

              <div className="space-y-2 max-h-[400px] overflow-y-auto">
                {folders.map((folder) => {
                  const colorClass = colors.find((c) => c.value === folder.color)?.class || "bg-blue-500"
                  return (
                    <Card
                      key={folder.id}
                      className="p-4 cursor-pointer hover:bg-accent transition-colors"
                      onClick={() => handleSelectFolder(folder.id)}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded ${colorClass} flex items-center justify-center flex-shrink-0`}>
                          <Folder className="h-4 w-4 text-white" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium">{folder.name}</p>
                        </div>
                      </div>
                    </Card>
                  )
                })}

                {folders.length === 0 && (
                  <div className="text-center py-8 text-muted-foreground">אין תיקיות. צור תיקייה חדשה.</div>
                )}
              </div>
            </>
          ) : (
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>שם התיקייה</Label>
                <Input
                  value={newFolderName}
                  onChange={(e) => setNewFolderName(e.target.value)}
                  placeholder="הזן שם..."
                  dir="rtl"
                />
              </div>

              <div className="space-y-2">
                <Label>צבע</Label>
                <div className="flex gap-2 flex-wrap">
                  {colors.map((color) => (
                    <button
                      key={color.value}
                      type="button"
                      className={`w-10 h-10 rounded-lg ${color.class} ${
                        newFolderColor === color.value ? "ring-2 ring-offset-2 ring-primary" : ""
                      }`}
                      onClick={() => setNewFolderColor(color.value)}
                    />
                  ))}
                </div>
              </div>

              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setShowCreateNew(false)} disabled={loading} className="flex-1">
                  חזור
                </Button>
                <Button onClick={handleCreateAndAdd} disabled={loading || !newFolderName.trim()} className="flex-1">
                  {loading ? "יוצר..." : "צור והוסף"}
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            ביטול
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
