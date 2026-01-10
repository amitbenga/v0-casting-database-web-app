"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { createClient } from "@/lib/supabase/client"

interface AddActorToFolderDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  folderId: string
  onActorsAdded?: () => void
}

export function AddActorToFolderDialog({ open, onOpenChange, folderId, onActorsAdded }: AddActorToFolderDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedActors, setSelectedActors] = useState<string[]>([])
  const [actors, setActors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      loadActors()
    }
  }, [open])

  async function loadActors() {
    try {
      setLoading(true)
      const supabase = createClient()

      const [actorsResult, folderActorsResult] = await Promise.all([
        supabase.from("actors").select("*").order("full_name"),
        supabase.from("folder_actors").select("actor_id").eq("folder_id", folderId),
      ])

      if (actorsResult.error) throw actorsResult.error

      const existingActorIds = new Set(folderActorsResult.data?.map((fa) => fa.actor_id) || [])

      const availableActors = (actorsResult.data || []).filter((actor) => !existingActorIds.has(actor.id))

      setActors(availableActors)
    } catch (error) {
      console.error("[v0] Error loading actors:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const supabase = createClient()

      const { data: existingAssignments } = await supabase
        .from("folder_actors")
        .select("actor_id")
        .eq("folder_id", folderId)
        .in("actor_id", selectedActors)

      const existingActorIds = new Set(existingAssignments?.map((a) => a.actor_id) || [])
      const newActorIds = selectedActors.filter((id) => !existingActorIds.has(id))

      if (newActorIds.length === 0) {
        alert("כל השחקנים שנבחרו כבר נמצאים בתיקייה")
        setLoading(false)
        return
      }

      const folderActors = newActorIds.map((actorId) => ({
        folder_id: folderId,
        actor_id: actorId,
      }))

      const { error } = await supabase.from("folder_actors").insert(folderActors)

      if (error) throw error

      onActorsAdded?.()
      onOpenChange(false)
      setSelectedActors([])
      setSearchQuery("")
    } catch (error) {
      console.error("[v0] Error adding actors to folder:", error)
      alert("שגיאה בהוספת שחקנים לתיקייה: " + (error as any).message)
    } finally {
      setLoading(false)
    }
  }

  const filteredActors = actors.filter((actor) => actor.full_name.toLowerCase().includes(searchQuery.toLowerCase()))

  const toggleActor = (actorId: string) => {
    setSelectedActors((prev) => (prev.includes(actorId) ? prev.filter((id) => id !== actorId) : [...prev, actorId]))
  }

  const getGenderLabel = (gender: string) => {
    return gender === "male" ? "זכר" : gender === "female" ? "נקבה" : gender
  }

  const getGenderStyle = (gender: string) => {
    return gender === "male" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>הוסף שחקנים לתיקייה</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label>חפש שחקנים</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש לפי שם..."
                className="pr-9"
                dir="rtl"
              />
            </div>
          </div>

          <div className="space-y-3 max-h-[400px] overflow-y-auto">
            {filteredActors.map((actor) => {
              const currentAge = actor.birth_year ? new Date().getFullYear() - actor.birth_year : null

              return (
                <Card
                  key={actor.id}
                  className={`p-4 cursor-pointer transition-colors ${
                    selectedActors.includes(actor.id) ? "border-primary bg-primary/5" : ""
                  }`}
                  onClick={() => toggleActor(actor.id)}
                >
                  <div className="flex items-center gap-4">
                    <Checkbox checked={selectedActors.includes(actor.id)} />
                    <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      {actor.image_url ? (
                        <img
                          src={actor.image_url || "/placeholder.svg"}
                          alt={actor.full_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div
                          className={`w-full h-full flex items-center justify-center text-2xl ${getGenderStyle(actor.gender)}`}
                        >
                          {actor.gender === "male" ? "♂" : "♀"}
                        </div>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{actor.full_name}</p>
                      <p className="text-sm text-muted-foreground">
                        {getGenderLabel(actor.gender)}
                        {currentAge && ` • גיל ${currentAge}`}
                      </p>
                    </div>
                  </div>
                </Card>
              )
            })}

            {filteredActors.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">לא נמצאו שחקנים</div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              ביטול
            </Button>
            <Button type="submit" disabled={selectedActors.length === 0 || loading}>
              {loading ? "מוסיף..." : `הוסף ${selectedActors.length} שחקנים`}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
