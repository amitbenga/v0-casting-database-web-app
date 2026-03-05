"use client"

import { useState } from "react"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { UserPlus, X, FileText, Play, Loader2, AlertTriangle } from "lucide-react"
import { ActorSearchAutocomplete } from "./actor-search-autocomplete"
import {
  assignActorToRole,
  unassignActorFromRole,
  updateCastingStatus,
  updateCastingDetails,
  deleteRole,
} from "@/lib/actions/casting-actions"
import {
  type ProjectRoleWithCasting,
  type RoleCasting,
  type RoleConflict,
  type CastingStatus,
  CASTING_STATUS_LIST,
  CASTING_STATUS_COLORS,
} from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

interface RoleCastingCardProps {
  role: ProjectRoleWithCasting
  conflicts?: RoleConflict[]
  isChild?: boolean
  onUpdate: () => void
}

export function RoleCastingCard({ role, conflicts = [], isChild = false, onUpdate }: RoleCastingCardProps) {
  const { toast } = useToast()
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  // Notes sheet — tracks which casting's notes are open
  const [notesSheetOpen, setNotesSheetOpen] = useState(false)
  const [notesCastingActorId, setNotesCastingActorId] = useState<string | null>(null)
  const [localNotes, setLocalNotes] = useState("")
  const [localReplicasPlanned, setLocalReplicasPlanned] = useState("")
  const [localReplicasFinal, setLocalReplicasFinal] = useState("")

  // All castings for this role (backward-compat fallback to single casting)
  const castings: RoleCasting[] = role.castings?.length
    ? role.castings
    : role.casting
    ? [role.casting]
    : []

  const mainCasting = castings.find((c) => c.status === "מלוהק") ?? castings[0] ?? null

  const handleAssignActor = async (actor: { id: string; name: string; image_url?: string }) => {
    setIsAssigning(true)
    try {
      const result = await assignActorToRole(role.id, actor.id)

      if (!result.success) {
        toast({
          title: "שגיאת שיבוץ",
          description: result.message_he || result.error || "שגיאה בשיבוץ השחקן",
          variant: "destructive",
        })
        return
      }

      toast({
        title: "שחקן שובץ בהצלחה",
        description: `${actor.name} שובץ לתפקיד ${role.role_name}`,
      })
      setShowSearch(false)
      onUpdate()
    } catch {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בעת שיבוץ השחקן",
        variant: "destructive",
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleUnassignActor = async (actorId: string) => {
    setIsUpdating(true)
    try {
      const result = await unassignActorFromRole(role.id, actorId)
      if (result.success) {
        toast({ title: "השיבוץ בוטל" })
        onUpdate()
      } else {
        toast({
          title: "שגיאה",
          description: result.error || "אירעה שגיאה בעת ביטול השיבוץ",
          variant: "destructive",
        })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStatusChange = async (actorId: string, newStatus: CastingStatus) => {
    setIsUpdating(true)
    try {
      const result = await updateCastingStatus(role.id, actorId, newStatus)
      if (result.success) {
        onUpdate()
      } else {
        toast({
          title: "שגיאה",
          description: result.error || "אירעה שגיאה בעת עדכון הסטטוס",
          variant: "destructive",
        })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const openNotesSheet = (casting: RoleCasting) => {
    setNotesCastingActorId(casting.actor_id)
    setLocalNotes(casting.notes || "")
    setLocalReplicasPlanned(casting.replicas_planned?.toString() || "")
    setLocalReplicasFinal(casting.replicas_final?.toString() || "")
    setNotesSheetOpen(true)
  }

  const handleSaveNotes = async () => {
    if (!notesCastingActorId) return
    setIsUpdating(true)
    try {
      const result = await updateCastingDetails(role.id, notesCastingActorId, {
        notes: localNotes,
        replicas_planned: localReplicasPlanned ? parseInt(localReplicasPlanned) : undefined,
        replicas_final: localReplicasFinal ? parseInt(localReplicasFinal) : undefined,
      })
      if (result.success) {
        setNotesSheetOpen(false)
        onUpdate()
        toast({ title: "נשמר בהצלחה" })
      } else {
        toast({
          title: "שגיאה",
          description: result.error || "אירעה שגיאה בעת שמירת הפרטים",
          variant: "destructive",
        })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleDeleteRole = async () => {
    if (!confirm(`האם למחוק את התפקיד "${role.role_name}"?`)) return

    setIsUpdating(true)
    try {
      const result = await deleteRole(role.id)
      if (result.success) {
        toast({ title: "התפקיד נמחק" })
        onUpdate()
      } else {
        toast({
          title: "שגיאה",
          description: result.error || "אירעה שגיאה במחיקת התפקיד",
          variant: "destructive",
        })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className={`p-4 ${isChild ? "mr-6 border-r-4 border-r-muted" : ""}`}>
      <div className="flex items-start justify-between gap-4">
        {/* Role Info — left */}
        <div className="min-w-0 flex-1">
          {/* Role name */}
          <div className="flex items-center gap-2">
            <h4 className="font-medium truncate">{role.role_name}</h4>
            {role.source === "script" && (
              <Badge variant="outline" className="text-xs">מתסריט</Badge>
            )}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {role.replicas_count} רפליקות
          </p>

          {/* Show assigned actor names */}
          {castings.length > 0 && (
            <p className="text-sm text-muted-foreground mt-1">
              {castings.map((c) => c.actor?.full_name || "שחקן").join(", ")}
            </p>
          )}
        </div>

        {/* Casting Section — right */}
        <div className="flex flex-col gap-2 flex-shrink-0 items-end">
          {/* Assigned actors */}
          {castings.map((casting) => (
            <div key={casting.id} className="flex items-center gap-2">
              {/* Actor chip */}
              <div className="flex items-center gap-2 p-1.5 bg-muted rounded-lg">
                <Avatar className="h-7 w-7">
                  <AvatarImage src={casting.actor?.image_url} alt={casting.actor?.full_name} />
                  <AvatarFallback className="text-xs">
                    {(casting.actor?.full_name || "ש").charAt(0)}
                  </AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{casting.actor?.full_name || "שחקן"}</span>
                {casting.actor?.voice_sample_url && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      const audio = new Audio(casting.actor!.voice_sample_url!)
                      audio.play()
                    }}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Status dropdown */}
              <Select
                value={casting.status}
                onValueChange={(v) => handleStatusChange(casting.actor_id, v as CastingStatus)}
                disabled={isUpdating}
              >
                <SelectTrigger className={`w-[110px] h-8 text-xs ${CASTING_STATUS_COLORS[casting.status] || ""}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASTING_STATUS_LIST.map((status) => (
                    <SelectItem key={status} value={status} className="text-xs">
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Notes */}
              <Button
                size="icon"
                variant="ghost"
                className={`h-8 w-8 ${casting.notes ? "text-primary" : "text-muted-foreground"}`}
                onClick={() => openNotesSheet(casting)}
                title="הערות"
              >
                <FileText className="h-4 w-4" />
              </Button>

              {/* Unassign */}
              <Button
                size="icon"
                variant="ghost"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => handleUnassignActor(casting.actor_id)}
                disabled={isUpdating}
                title="הסר שחקן"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          ))}

          {/* Cast button — shown when no search is open */}
          {!showSearch && (
            <Button
              size="sm"
              variant={castings.length === 0 ? "outline" : "ghost"}
              className={`h-7 text-xs ${castings.length === 0 ? "" : "self-end text-muted-foreground"}`}
              onClick={() => setShowSearch(true)}
            >
              <UserPlus className="h-3 w-3 ml-1" />
              {castings.length === 0 ? "שבץ שחקן" : "הוסף שחקן"}
            </Button>
          )}

          {/* Actor search */}
          {showSearch && (
            <div className="flex items-center gap-2">
              <ActorSearchAutocomplete
                onSelect={handleAssignActor}
                disabled={isAssigning}
                placeholder="חיפוש שחקן לשיבוץ..."
              />
              {isAssigning && <Loader2 className="h-4 w-4 animate-spin" />}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowSearch(false)}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>

      {/* Conflict Warnings */}
      {conflicts.length > 0 && (
        <div className="mt-2 space-y-1">
          {conflicts
            .filter((c) => c.role_id_a === role.id || c.role_id_b === role.id)
            .map((conflict, idx) => (
              <div key={idx} className="flex items-center gap-2 text-xs text-amber-600 bg-amber-50 p-1 rounded border border-amber-100">
                <AlertTriangle className="h-3 w-3" />
                <span>
                  קונפליקט עם {conflict.role_id_a === role.id ? conflict.role_b_name : conflict.role_a_name}
                  {conflict.scene_reference && ` (סצנה: ${conflict.scene_reference})`}
                </span>
              </div>
            ))}
        </div>
      )}

      {/* Replicas badge — shown for the מלוהק casting (or first) */}
      {mainCasting && (mainCasting.replicas_planned || mainCasting.replicas_final) && (
        <div className="mt-2 flex gap-2">
          {mainCasting.replicas_planned && (
            <Badge variant="outline">מתוכנן: {mainCasting.replicas_planned}</Badge>
          )}
          {mainCasting.replicas_final && (
            <Badge variant="secondary">סופי: {mainCasting.replicas_final}</Badge>
          )}
        </div>
      )}

      {/* Notes sheet */}
      <Sheet open={notesSheetOpen} onOpenChange={setNotesSheetOpen}>
        <SheetContent side="left" className="w-[400px]">
          <SheetHeader>
            <SheetTitle>
              פרטי שיבוץ — {role.role_name}
              {notesCastingActorId && castings.find((c) => c.actor_id === notesCastingActorId) && (
                <span className="font-normal text-muted-foreground mr-1">
                  ({castings.find((c) => c.actor_id === notesCastingActorId)?.actor?.full_name})
                </span>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="mt-6 space-y-6">
            <div className="space-y-2">
              <Label>הערות</Label>
              <Textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                placeholder="הערות לשיבוץ..."
                rows={4}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>רפליקות מתוכננות</Label>
                <Input
                  type="number"
                  value={localReplicasPlanned}
                  onChange={(e) => setLocalReplicasPlanned(e.target.value)}
                  placeholder={role.replicas_count.toString()}
                />
              </div>
              <div className="space-y-2">
                <Label>רפליקות סופי</Label>
                <Input
                  type="number"
                  value={localReplicasFinal}
                  onChange={(e) => setLocalReplicasFinal(e.target.value)}
                  placeholder="0"
                />
              </div>
            </div>
            <Button onClick={handleSaveNotes} disabled={isUpdating} className="w-full">
              {isUpdating && <Loader2 className="h-4 w-4 ml-2 animate-spin" />}
              שמירה
            </Button>
          </div>
        </SheetContent>
      </Sheet>
    </Card>
  )
}
