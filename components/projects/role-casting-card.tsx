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
  SheetTrigger,
} from "@/components/ui/sheet"
import { Label } from "@/components/ui/label"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { UserPlus, X, Play, FileText, Loader2, Trash2, AlertTriangle, Plus } from "lucide-react"
import { ActorSearchAutocomplete } from "./actor-search-autocomplete"
import { Checkbox } from "@/components/ui/checkbox"
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
  isSelected?: boolean
  onToggleSelect?: (id: string) => void
}

// One row per assigned actor
function CastingRow({
  casting,
  roleId,
  roleName,
  replicasCount,
  onUpdate,
}: {
  casting: RoleCasting
  roleId: string
  roleName: string
  replicasCount: number
  onUpdate: () => void
}) {
  const { toast } = useToast()
  const [isUpdating, setIsUpdating] = useState(false)
  const [notesOpen, setNotesOpen] = useState(false)
  const [localNotes, setLocalNotes] = useState(casting.notes || "")
  const [localReplicasPlanned, setLocalReplicasPlanned] = useState(
    casting.replicas_planned?.toString() || ""
  )
  const [localReplicasFinal, setLocalReplicasFinal] = useState(
    casting.replicas_final?.toString() || ""
  )

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const actor = (casting as any).actor

  const handleStatusChange = async (status: CastingStatus) => {
    setIsUpdating(true)
    try {
      const result = await updateCastingStatus(casting.id, status)
      if (result.success) {
        onUpdate()
      } else {
        toast({ title: "שגיאה", description: result.error, variant: "destructive" })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleUnassign = async () => {
    setIsUpdating(true)
    try {
      const result = await unassignActorFromRole(roleId, casting.actor_id)
      if (result.success) {
        toast({ title: "השיבוץ בוטל", description: `${actor?.full_name || "השחקן"} הוסר מ-${roleName}` })
        onUpdate()
      } else {
        toast({ title: "שגיאה", description: result.error, variant: "destructive" })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleSaveNotes = async () => {
    setIsUpdating(true)
    try {
      const result = await updateCastingDetails(casting.id, {
        notes: localNotes,
        replicas_planned: localReplicasPlanned ? parseInt(localReplicasPlanned) : undefined,
        replicas_final: localReplicasFinal ? parseInt(localReplicasFinal) : undefined,
      })
      if (result.success) {
        setNotesOpen(false)
        onUpdate()
        toast({ title: "נשמר בהצלחה" })
      } else {
        toast({ title: "שגיאה", description: result.error, variant: "destructive" })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <div className="flex items-center gap-2 mt-2 flex-wrap">
      {/* Actor chip */}
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
        <Avatar className="h-7 w-7">
          <AvatarImage src={actor?.image_url} alt={actor?.full_name} />
          <AvatarFallback className="text-xs">{(actor?.full_name || "ש").charAt(0)}</AvatarFallback>
        </Avatar>
        <span className="text-sm font-medium">{actor?.full_name || "שחקן"}</span>
        {actor?.voice_sample_url && (
          <Button
            size="icon"
            variant="ghost"
            className="h-6 w-6"
            onClick={() => new Audio(actor.voice_sample_url).play()}
            title="השמע דוגמת קול"
          >
            <Play className="h-3 w-3" />
          </Button>
        )}
      </div>

      {/* Status dropdown */}
      <Select
        value={casting.status}
        onValueChange={(v) => handleStatusChange(v as CastingStatus)}
        disabled={isUpdating}
      >
        <SelectTrigger className={`w-[120px] ${CASTING_STATUS_COLORS[casting.status] || ""}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {CASTING_STATUS_LIST.map((s) => (
            <SelectItem key={s} value={s}>{s}</SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Notes sheet */}
      <Sheet open={notesOpen} onOpenChange={setNotesOpen}>
        <SheetTrigger asChild>
          <Button
            size="icon"
            variant="ghost"
            className={casting.notes ? "text-primary" : "text-muted-foreground"}
            title="הערות ורפליקות"
          >
            <FileText className="h-4 w-4" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[400px]">
          <SheetHeader>
            <SheetTitle>פרטי שיבוץ — {roleName} / {actor?.full_name}</SheetTitle>
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
                  placeholder={replicasCount.toString()}
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

      {/* Unassign button */}
      <Button
        size="icon"
        variant="ghost"
        onClick={handleUnassign}
        disabled={isUpdating}
        className="text-destructive hover:text-destructive"
        title="בטל שיבוץ"
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  )
}

export function RoleCastingCard({
  role,
  conflicts = [],
  isChild = false,
  onUpdate,
  isSelected = false,
  onToggleSelect,
}: RoleCastingCardProps) {
  const { toast } = useToast()
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showSearch, setShowSearch] = useState(false)

  const hasCastings = role.castings.length > 0

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
      toast({ title: "שגיאה", description: "אירעה שגיאה בעת שיבוץ השחקן", variant: "destructive" })
    } finally {
      setIsAssigning(false)
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
        toast({ title: "שגיאה", description: result.error, variant: "destructive" })
      }
    } finally {
      setIsUpdating(false)
    }
  }

  return (
    <Card className={`p-4 ${isChild ? "mr-6 border-r-4 border-r-muted" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}>
      {/* Header: checkbox + role name + replicas + delete (for empty manual roles) */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {onToggleSelect && (
            <Checkbox
              checked={isSelected}
              onCheckedChange={() => onToggleSelect(role.id)}
              aria-label={`בחר תפקיד ${role.role_name}`}
              className="flex-shrink-0"
            />
          )}
          <div className="min-w-0 flex-1">
            <h4 className="font-medium truncate">{role.role_name}</h4>
            <p className="text-sm text-muted-foreground">{role.replicas_count} רפליקות</p>
          </div>
        </div>

        {role.source === "manual" && !hasCastings && (
          <Button
            size="icon"
            variant="ghost"
            onClick={handleDeleteRole}
            disabled={isUpdating}
            className="text-destructive hover:text-destructive flex-shrink-0"
            title="מחק תפקיד"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* One row per assigned actor */}
      {role.castings.map((casting) => (
        <CastingRow
          key={casting.id}
          casting={casting}
          roleId={role.id}
          roleName={role.role_name}
          replicasCount={role.replicas_count}
          onUpdate={onUpdate}
        />
      ))}

      {/* Actor search / add buttons */}
      <div className="mt-3">
        {showSearch ? (
          <div className="flex items-center gap-2 w-[300px]">
            <ActorSearchAutocomplete
              onSelect={handleAssignActor}
              disabled={isAssigning}
              placeholder="חיפוש שחקן לשיבוץ..."
            />
            {isAssigning && <Loader2 className="h-4 w-4 animate-spin" />}
            <Button size="icon" variant="ghost" onClick={() => setShowSearch(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        ) : hasCastings ? (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(true)}
            className="text-muted-foreground"
          >
            <Plus className="h-4 w-4 ml-1" />
            הוסף שחקן
          </Button>
        ) : (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowSearch(true)}
          >
            <UserPlus className="h-4 w-4 ml-2" />
            שיבוץ שחקן
          </Button>
        )}
      </div>

      {/* Conflict Warnings */}
      {conflicts.length > 0 && (
        <div className="mt-2 space-y-1">
          {conflicts
            .filter(c => c.role_id_a === role.id || c.role_id_b === role.id)
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
    </Card>
  )
}
