"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Search } from "lucide-react"
import { Card } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createBrowserClient } from "@/lib/supabase/client"

interface AddActorToProjectDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  projectId: string
  roles?: any[]
  onActorsAdded?: () => void
}

export function AddActorToProjectDialog({
  open,
  onOpenChange,
  projectId,
  roles = [],
  onActorsAdded,
}: AddActorToProjectDialogProps) {
  const [searchQuery, setSearchQuery] = useState("")
  const [selectedActors, setSelectedActors] = useState<string[]>([])
  const [actors, setActors] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedRoleId, setSelectedRoleId] = useState<string>("")
  const [newRoleName, setNewRoleName] = useState("")
  const [replicasPlanned, setReplicasPlanned] = useState("")
  const [notes, setNotes] = useState("")
  const hasLoadedActors = useRef(false)

  useEffect(() => {
    if (open && !hasLoadedActors.current) {
      hasLoadedActors.current = true
      loadActors()
    }

    if (open) {
      setSelectedRoleId("")
      setNewRoleName("")
      setSelectedActors([])
      setSearchQuery("")
      setReplicasPlanned("")
      setNotes("")
    }

    if (!open) {
      hasLoadedActors.current = false
    }
  }, [open])

  async function loadActors() {
    try {
      setLoading(true)
      const supabase = createBrowserClient()
      const { data, error } = await supabase.from("actors").select("*").order("full_name")

      if (error) throw error

      setActors(data || [])
    } catch (error) {
      console.error("[v0] Error loading actors:", error)
    } finally {
      setLoading(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    const roleName =
      selectedRoleId === "new" ? newRoleName.trim() : roles.find((r) => r.id === selectedRoleId)?.role_name

    if (!selectedRoleId || (selectedRoleId === "new" && !newRoleName.trim())) {
      alert("יש לבחור תפקיד או להזין שם תפקיד חדש")
      return
    }

    if (selectedActors.length === 0) {
      alert("יש לבחור לפחות שחקן אחד")
      return
    }

    try {
      const supabase = createBrowserClient()
      let roleId = selectedRoleId !== "new" ? selectedRoleId : null

      if (selectedRoleId === "new") {
        const { data: newRole, error: roleError } = await supabase
          .from("project_roles")
          .insert({
            project_id: projectId,
            role_name: newRoleName.trim(),
            replicas_needed: replicasPlanned ? Number.parseInt(replicasPlanned) : 0,
          })
          .select()
          .single()

        if (roleError) throw roleError
        roleId = newRole.id
      }

      const projectActorRecords = selectedActors.map((actorId) => ({
        project_id: projectId,
        actor_id: actorId,
        role_id: roleId,
        role_name: roleName,
        replicas_planned: replicasPlanned ? Number.parseInt(replicasPlanned) : null,
        notes: notes || null,
      }))

      const { error } = await supabase.from("project_actors").insert(projectActorRecords)

      if (error) throw error

      onActorsAdded?.()
      onOpenChange(false)

      setSelectedActors([])
      setSearchQuery("")
      setSelectedRoleId("")
      setNewRoleName("")
      setReplicasPlanned("")
      setNotes("")
    } catch (error) {
      console.error("[v0] Error adding actors to project:", error)
      alert("שגיאה בהוספת שחקנים לפרויקט")
    }
  }

  const filteredActors = actors.filter((actor) => actor.full_name.toLowerCase().includes(searchQuery.toLowerCase()))

  const toggleActor = (actorId: string) => {
    setSelectedActors((prev) => (prev.includes(actorId) ? prev.filter((id) => id !== actorId) : [...prev, actorId]))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" dir="rtl">
        <DialogHeader>
          <DialogTitle>הוסף שחקנים לפרויקט</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-6 flex-1 overflow-hidden flex flex-col">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="role">תפקיד *</Label>
              <Select value={selectedRoleId} onValueChange={setSelectedRoleId}>
                <SelectTrigger>
                  <SelectValue placeholder="בחר תפקיד או צור חדש" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="new">+ צור תפקיד חדש</SelectItem>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      {role.role_name} {role.replicas_needed > 0 && `(${role.replicas_needed} רפליקות)`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedRoleId === "new" && (
              <div className="space-y-2">
                <Label htmlFor="newRoleName">שם התפקיד החדש *</Label>
                <Input
                  id="newRoleName"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="למשל: דמות ראשית, קריין..."
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="replicasPlanned">מספר רפליקות מתוכנן</Label>
              <Input
                id="replicasPlanned"
                type="number"
                min="0"
                value={replicasPlanned}
                onChange={(e) => setReplicasPlanned(e.target.value)}
                placeholder="למשל: 5"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">הערות (אופציונלי)</Label>
            <Input id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="הערות נוספות..." />
          </div>

          <div className="space-y-2">
            <Label>חיפוש שחקנים</Label>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="חפש לפי שם..."
                className="pr-9"
              />
            </div>
          </div>

          <div className="space-y-3 flex-1 overflow-y-auto min-h-0">
            {loading ? (
              <div className="text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
                <p className="text-sm text-muted-foreground mt-2">טוען שחקנים...</p>
              </div>
            ) : filteredActors.length === 0 ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">לא נמצאו שחקנים</p>
              </div>
            ) : (
              filteredActors.map((actor) => {
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
                      <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        {actor.photo_url ? (
                          <img
                            src={actor.photo_url || "/placeholder.svg"}
                            alt={actor.full_name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div
                            className={`w-full h-full flex items-center justify-center ${
                              actor.gender === "זכר" ? "bg-blue-100 text-blue-600" : "bg-pink-100 text-pink-600"
                            }`}
                          >
                            {actor.gender === "זכר" ? "♂" : "♀"}
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium truncate">{actor.full_name}</p>
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <span>{actor.gender}</span>
                          {currentAge && (
                            <>
                              <span>•</span>
                              <span>גיל {currentAge}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </Card>
                )
              })
            )}
          </div>

          <DialogFooter className="flex-shrink-0 gap-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              ביטול
            </Button>
            <Button
              type="submit"
              disabled={
                selectedActors.length === 0 || !selectedRoleId || (selectedRoleId === "new" && !newRoleName.trim())
              }
            >
              הוסף {selectedActors.length} {selectedActors.length === 1 ? "שחקן" : "שחקנים"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
