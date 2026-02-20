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
import { UserPlus, X, RefreshCw, FileText, Play, Loader2, Trash2, AlertTriangle } from "lucide-react"
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

export function RoleCastingCard({ role, conflicts = [], isChild = false, onUpdate, isSelected = false, onToggleSelect }: RoleCastingCardProps) {
  const { toast } = useToast()
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)
  const [showSearch, setShowSearch] = useState(false)
  const [notesSheetOpen, setNotesSheetOpen] = useState(false)
  const [localNotes, setLocalNotes] = useState(role.casting?.notes || "")
  const [localReplicasPlanned, setLocalReplicasPlanned] = useState(
    role.casting?.replicas_planned?.toString() || ""
  )
  const [localReplicasFinal, setLocalReplicasFinal] = useState(
    role.casting?.replicas_final?.toString() || ""
  )

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
    } catch (error) {
      toast({
        title: "שגיאה",
        description: "אירעה שגיאה בעת שיבוץ השחקן",
        variant: "destructive",
      })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleUnassign = async () => {
    setIsUpdating(true)
    try {
      const result = await unassignActorFromRole(role.id)
      if (result.success) {
        toast({
          title: "השיבוץ בוטל",
          description: `התפקיד ${role.role_name} כעת פנוי`,
        })
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

  const handleStatusChange = async (newStatus: CastingStatus) => {
    setIsUpdating(true)
    try {
      const result = await updateCastingStatus(role.id, newStatus)
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

  const handleSaveNotes = async () => {
    setIsUpdating(true)
    try {
      const result = await updateCastingDetails(role.id, {
        notes: localNotes,
        replicas_planned: localReplicasPlanned ? parseInt(localReplicasPlanned) : undefined,
        replicas_final: localReplicasFinal ? parseInt(localReplicasFinal) : undefined,
      })
      if (result.success) {
        setNotesSheetOpen(false)
        onUpdate()
        toast({
          title: "נשמר בהצלחה",
        })
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
        toast({
          title: "התפקיד נמחק",
        })
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

  // Get status badge color
  const getStatusBadgeClass = (status: CastingStatus) => {
    return CASTING_STATUS_COLORS[status] || ""
  }

  return (
    <Card className={`p-4 ${isChild ? "mr-6 border-r-4 border-r-muted" : ""} ${isSelected ? "ring-2 ring-primary" : ""}`}>
      <div className="flex items-center justify-between gap-4">
        {/* Checkbox for bulk selection */}
        {onToggleSelect && (
          <Checkbox
            checked={isSelected}
            onCheckedChange={() => onToggleSelect(role.id)}
            aria-label={`בחר תפקיד ${role.role_name}`}
            className="flex-shrink-0"
          />
        )}

        {/* Role Info */}
        <div className="flex items-center gap-4 min-w-0 flex-1">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h4 className="font-medium truncate">{role.role_name}</h4>
              {role.source === "script" && (
                <Badge variant="outline" className="text-xs">מתסריט</Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {role.replicas_count} רפליקות
            </p>
          </div>
        </div>

        {/* Casting Section */}
        <div className="flex items-center gap-3 flex-shrink-0">
          {role.casting ? (
            <>
              {/* Actor Card */}
              <div className="flex items-center gap-2 p-2 bg-muted rounded-lg">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={role.casting.actor?.image_url} alt={role.casting.actor?.full_name} />
                  <AvatarFallback>{(role.casting.actor?.full_name || "ש").charAt(0)}</AvatarFallback>
                </Avatar>
                <span className="text-sm font-medium">{role.casting.actor?.full_name || "שחקן"}</span>
                
                {role.casting.actor?.voice_sample_url && (
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-6 w-6"
                    onClick={() => {
                      const audio = new Audio(role.casting!.actor.voice_sample_url)
                      audio.play()
                    }}
                  >
                    <Play className="h-3 w-3" />
                  </Button>
                )}
              </div>

              {/* Status Dropdown */}
              <Select
                value={role.casting.status}
                onValueChange={(v) => handleStatusChange(v as CastingStatus)}
                disabled={isUpdating}
              >
                <SelectTrigger className={`w-[120px] ${getStatusBadgeClass(role.casting.status)}`}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CASTING_STATUS_LIST.map((status) => (
                    <SelectItem key={status} value={status}>
                      {status}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Notes Button */}
              <Sheet open={notesSheetOpen} onOpenChange={setNotesSheetOpen}>
                <SheetTrigger asChild>
                  <Button
                    size="icon"
                    variant="ghost"
                    className={role.casting.notes ? "text-primary" : "text-muted-foreground"}
                  >
                    <FileText className="h-4 w-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-[400px]">
                  <SheetHeader>
                    <SheetTitle>פרטי שיבוץ - {role.role_name}</SheetTitle>
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

              {/* Replace Button */}
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setShowSearch(true)}
                disabled={isUpdating}
                title="החלף שחקן"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>

              {/* Unassign Button */}
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
            </>
          ) : showSearch ? (
            <div className="flex items-center gap-2 w-[300px]">
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
          ) : (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSearch(true)}
              >
                <UserPlus className="h-4 w-4 ml-2" />
                שיבוץ שחקן
              </Button>
              
              {/* Delete role button (only for manual roles without casting) */}
              {role.source === "manual" && (
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={handleDeleteRole}
                  disabled={isUpdating}
                  className="text-destructive hover:text-destructive"
                  title="מחק תפקיד"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </>
          )}
        </div>
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

      {/* Casting replicas badge */}
      {role.casting && (role.casting.replicas_planned || role.casting.replicas_final) && (
        <div className="mt-2 flex gap-2">
          {role.casting.replicas_planned && (
            <Badge variant="outline">
              מתוכנן: {role.casting.replicas_planned}
            </Badge>
          )}
          {role.casting.replicas_final && (
            <Badge variant="secondary">
              סופי: {role.casting.replicas_final}
            </Badge>
          )}
        </div>
      )}
    </Card>
  )
}
