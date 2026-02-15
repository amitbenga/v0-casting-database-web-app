"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import {
  Search,
  ArrowUpDown,
  Loader2,
  Plus,
  UserPlus,
  X,
  RefreshCw,
  Trash2,
  AlertTriangle,
  Users,
  Clapperboard,
  Download,
} from "lucide-react"
import { ActorSearchAutocomplete } from "./actor-search-autocomplete"
import {
  exportCastingToExcel,
} from "@/lib/casting-export-import"
import {
  getProjectRolesWithCasting,
  createManualRole,
  assignActorToRole,
  unassignActorFromRole,
  updateCastingStatus,
  deleteRole,
} from "@/lib/actions/casting-actions"
import type { ProjectRoleWithCasting, RoleConflict, CastingStatus } from "@/lib/types"
import { CASTING_STATUS_LIST, CASTING_STATUS_COLORS } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

const EMPTY_CONFLICTS: RoleConflict[] = []

async function runInChunks<T, R>(
  items: T[],
  worker: (item: T) => Promise<R>,
  chunkSize: number
): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = []

  for (let i = 0; i < items.length; i += chunkSize) {
    const chunk = items.slice(i, i + chunkSize)
    const chunkResults = await Promise.allSettled(chunk.map(worker))
    results.push(...chunkResults)
  }

  return results
}

// ---------- Conflict Tooltip ----------

function ConflictTooltip({
  roleId,
  roleConflicts,
  roleLookup,
}: {
  roleId: string
  roleConflicts: RoleConflict[]
  roleLookup: Map<string, string>
}) {
  if (roleConflicts.length === 0) return null

  return (
    <TooltipProvider delayDuration={200}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help flex-shrink-0">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span className="text-[10px] text-amber-500 font-medium">{roleConflicts.length}</span>
          </div>
        </TooltipTrigger>
        <TooltipContent side="right" align="start" className="max-w-[320px] p-3">
          <p className="text-xs font-semibold mb-2">
            {"קונפליקטים"} ({roleConflicts.length})
          </p>
          <div className="space-y-2">
            {roleConflicts.map((c) => {
              const otherId = c.role_id_a === roleId ? c.role_id_b : c.role_id_a
              const otherName = roleLookup.get(otherId) || "Unknown"
              return (
                <div key={c.id || `${c.role_id_a}-${c.role_id_b}`} className="text-xs space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <AlertTriangle className="h-3 w-3 text-amber-500 flex-shrink-0" />
                    <span className="font-medium">{otherName}</span>
                  </div>
                  {c.scene_reference && (
                    <p className="text-muted-foreground pr-4">{c.scene_reference}</p>
                  )}
                </div>
              )
            })}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

// ---------- Role Row ----------

interface RoleRowProps {
  role: ProjectRoleWithCasting
  roleConflicts: RoleConflict[]
  roleLookup: Map<string, string>
  isSelected: boolean
  onRoleNameClick: (roleId: string, e: React.MouseEvent) => void
  onUpdate: () => void
}

function RoleRow({ role, roleConflicts, roleLookup, isSelected, onRoleNameClick, onUpdate }: RoleRowProps) {
  const { toast } = useToast()
  const [showSearch, setShowSearch] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const handleAssignActor = async (actor: { id: string; name: string; image_url?: string }) => {
    setIsAssigning(true)
    try {
      const result = await assignActorToRole(role.id, actor.id)
      if (!result.success) {
        toast({
          title: "שגיאת ליהוק",
          description: result.message_he || result.error || "שגיאה בשיוך שחקן",
          variant: "destructive",
        })
        return
      }
      toast({ title: `${actor.name} שובץ ל-${role.role_name}` })
      setShowSearch(false)
      onUpdate()
    } catch {
      toast({ title: "שגיאה", description: "שיבוץ השחקן נכשל", variant: "destructive" })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleUnassign = async () => {
    setIsUpdating(true)
    try {
      const result = await unassignActorFromRole(role.id)
      if (result.success) {
        toast({ title: `${role.role_name} - שיוך בוטל` })
        onUpdate()
      }
    } finally {
      setIsUpdating(false)
    }
  }

  const handleStatusChange = async (newStatus: CastingStatus) => {
    setIsUpdating(true)
    try {
      const result = await updateCastingStatus(role.id, newStatus)
      if (result.success) onUpdate()
    } finally {
      setIsUpdating(false)
    }
  }

  const isCasted = !!role.casting

  return (
    <div
      className={`
        group flex items-center gap-3 px-4 py-2.5 
        border-b border-border/50 last:border-b-0
        transition-colors
        ${isSelected ? "bg-primary/8 ring-1 ring-inset ring-primary/20" : "hover:bg-muted/40"}
        ${isCasted ? "" : "bg-muted/10"}
      `}
    >
      {/* Role name - clickable for selection */}
      <div className="flex items-center gap-2 min-w-[180px] max-w-[260px]">
        <button
          type="button"
          className={`text-sm font-medium truncate text-right cursor-pointer transition-colors select-none ${
            isSelected
              ? "text-primary font-semibold"
              : isCasted
              ? "text-foreground hover:text-primary"
              : "text-muted-foreground hover:text-foreground"
          }`}
          onClick={(e) => onRoleNameClick(role.id, e)}
        >
          {role.role_name}
        </button>
        {role.source === "script" && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
            תסריט
          </Badge>
        )}
      </div>

      {/* Replicas count */}
      <div className="flex-shrink-0 w-16 text-center">
        <span className="text-xs text-muted-foreground">{role.replicas_count}</span>
      </div>

      {/* Conflict indicator */}
      <ConflictTooltip roleId={role.id} roleConflicts={roleConflicts} roleLookup={roleLookup} />

      {/* Casting section */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {role.casting ? (
          <>
            <div className="flex items-center gap-2 px-2 py-1 bg-muted/60 rounded-md">
              <Avatar className="h-6 w-6">
                <AvatarImage src={role.casting.actor?.image_url} alt={role.casting.actor?.full_name} />
                <AvatarFallback className="text-[10px]">
                  {(role.casting.actor?.full_name || "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium max-w-[140px] truncate">
                {role.casting.actor?.full_name || "שחקן"}
              </span>
            </div>

            <Select
              value={role.casting.status}
              onValueChange={(v) => handleStatusChange(v as CastingStatus)}
              disabled={isUpdating}
            >
              <SelectTrigger className={`w-[100px] h-7 text-xs ${CASTING_STATUS_COLORS[role.casting.status] || ""}`}>
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

            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSearch(true)} disabled={isUpdating} title="החלף שחקן">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleUnassign} disabled={isUpdating} title="בטל שיבוץ">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : showSearch ? (
          <div className="flex items-center gap-2 w-[280px]">
            <ActorSearchAutocomplete
              onSelect={handleAssignActor}
              disabled={isAssigning}
              placeholder="חיפוש שחקן..."
            />
            {isAssigning && <Loader2 className="h-4 w-4 animate-spin" />}
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSearch(false)}>
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground/60">לא משובץ</span>
        )}
      </div>
    </div>
  )
}

// ---------- Main Component ----------

interface CastingWorkspaceProps {
  projectId: string
}

export function CastingWorkspace({ projectId }: CastingWorkspaceProps) {
  const { toast } = useToast()
  const BULK_CONCURRENCY = 8
  const [roles, setRoles] = useState<ProjectRoleWithCasting[]>([])
  const [conflicts, setConflicts] = useState<RoleConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Selection state
  const [selectedRoleIds, setSelectedRoleIds] = useState<Set<string>>(new Set())
  const [lastClickedRoleId, setLastClickedRoleId] = useState<string | null>(null)
  const [showAssignSearch, setShowAssignSearch] = useState(false)
  const [isBulkAssigning, setIsBulkAssigning] = useState(false)
  const [isBulkDeleting, setIsBulkDeleting] = useState(false)

  // Filters
  const [search, setSearch] = useState("")
  const [showOnlyUnassigned, setShowOnlyUnassigned] = useState(false)
  const [sortByReplicas, setSortByReplicas] = useState<"asc" | "desc" | null>(null)

  // Add role dialog
  const [showAddRole, setShowAddRole] = useState(false)
  const [newRoleName, setNewRoleName] = useState("")
  const [newRoleReplicas, setNewRoleReplicas] = useState(0)
  const [isCreatingRole, setIsCreatingRole] = useState(false)
  const [isExporting, setIsExporting] = useState(false)

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getProjectRolesWithCasting(projectId)
      setRoles(response.roles)
      setConflicts(response.conflicts)
    } catch (err) {
      setError("שגיאה בטעינת תפקידים")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadRoles()
  }, [loadRoles])

  // Flatten all roles (parents + children) into a single flat list
  const flatRoles = useMemo(() => {
    const flat: ProjectRoleWithCasting[] = []
    for (const role of roles) {
      flat.push(role)
      if (role.children) {
        for (const child of role.children) {
          flat.push(child)
        }
      }
    }
    return flat
  }, [roles])

  const roleLookup = useMemo(() => {
    const lookup = new Map<string, string>()
    for (const role of flatRoles) {
      lookup.set(role.id, role.role_name)
    }
    return lookup
  }, [flatRoles])

  const conflictsByRoleId = useMemo(() => {
    const byRoleId = new Map<string, RoleConflict[]>()
    for (const conflict of conflicts) {
      const forRoleA = byRoleId.get(conflict.role_id_a)
      if (forRoleA) {
        forRoleA.push(conflict)
      } else {
        byRoleId.set(conflict.role_id_a, [conflict])
      }

      const forRoleB = byRoleId.get(conflict.role_id_b)
      if (forRoleB) {
        forRoleB.push(conflict)
      } else {
        byRoleId.set(conflict.role_id_b, [conflict])
      }
    }
    return byRoleId
  }, [conflicts])

  // Filter + sort on flat list
  const filteredRoles = useMemo(() => {
    let result = [...flatRoles]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) => {
        const matchesName = r.role_name.toLowerCase().includes(q)
        const matchesActor = r.casting?.actor?.full_name?.toLowerCase().includes(q)
        return matchesName || matchesActor
      })
    }

    if (showOnlyUnassigned) {
      result = result.filter((r) => !r.casting)
    }

    if (sortByReplicas) {
      result.sort((a, b) => {
        const diff = b.replicas_count - a.replicas_count
        return sortByReplicas === "desc" ? diff : -diff
      })
    }

    return result
  }, [flatRoles, search, showOnlyUnassigned, sortByReplicas])

  // Handle role name click - toggle selection, Shift for range
  const handleRoleNameClick = useCallback((roleId: string, e: React.MouseEvent) => {
    const isShift = e.shiftKey

    if (isShift && lastClickedRoleId) {
      // Shift+click: select range
      const ids = filteredRoles.map((r) => r.id)
      const startIdx = ids.indexOf(lastClickedRoleId)
      const endIdx = ids.indexOf(roleId)
      if (startIdx !== -1 && endIdx !== -1) {
        const [from, to] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx]
        const rangeIds = ids.slice(from, to + 1)
        setSelectedRoleIds((prev) => {
          const next = new Set(prev)
          rangeIds.forEach((id) => next.add(id))
          return next
        })
      }
    } else {
      // Simple click: toggle this role (add or remove)
      setSelectedRoleIds((prev) => {
        const next = new Set(prev)
        if (next.has(roleId)) {
          next.delete(roleId)
        } else {
          next.add(roleId)
        }
        return next
      })
    }
    setLastClickedRoleId(roleId)
    
    // Close assign search when selection changes
    setShowAssignSearch(false)
  }, [lastClickedRoleId, filteredRoles])

  const clearSelection = () => {
    setSelectedRoleIds(new Set())
    setLastClickedRoleId(null)
    setShowAssignSearch(false)
  }

  // Bulk assign actor to all selected roles
  const handleBulkAssign = async (actor: { id: string; name: string; image_url?: string }) => {
    setIsBulkAssigning(true)
    try {
      const ids = Array.from(selectedRoleIds)
      const results = await runInChunks(
        ids,
        (roleId) => assignActorToRole(roleId, actor.id),
        BULK_CONCURRENCY
      )

      const successCount = results.reduce((count, result) => {
        if (result.status === "fulfilled" && result.value.success) {
          return count + 1
        }
        return count
      }, 0)

      toast({
        title: `${actor.name} שובץ ל-${successCount} תפקידים`,
      })

      setShowAssignSearch(false)
      clearSelection()
      loadRoles()
    } finally {
      setIsBulkAssigning(false)
    }
  }

  // Bulk delete
  const handleBulkDelete = async () => {
    const count = selectedRoleIds.size
    if (!confirm(`האם למחוק ${count} תפקידים?`)) return

    setIsBulkDeleting(true)
    try {
      const ids = Array.from(selectedRoleIds)
      const results = await runInChunks(ids, (roleId) => deleteRole(roleId), BULK_CONCURRENCY)

      const deleted = results.reduce((count, result) => {
        if (result.status === "fulfilled" && result.value.success) {
          return count + 1
        }
        return count
      }, 0)

      toast({ title: `${deleted} תפקידים נמחקו` })
      clearSelection()
      loadRoles()
    } finally {
      setIsBulkDeleting(false)
    }
  }

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return
    setIsCreatingRole(true)
    try {
      const result = await createManualRole(projectId, newRoleName, undefined, newRoleReplicas)
      if (result.success) {
        toast({ title: `התפקיד "${newRoleName}" נוצר` })
        setNewRoleName("")
        setNewRoleReplicas(0)
        setShowAddRole(false)
        loadRoles()
      } else {
        toast({ title: "שגיאה", description: result.error, variant: "destructive" })
      }
    } finally {
      setIsCreatingRole(false)
    }
  }

  // Export to Excel (kept)
  const handleExportCasting = async () => {
    if (roles.length === 0) {
      toast({ title: "אין תפקידים לייצוא", variant: "destructive" })
      return
    }
    
    setIsExporting(true)
    try {
      await exportCastingToExcel(roles, `project-${projectId}`)
      toast({ title: "ליהוק יוצא בהצלחה" })
    } catch (error) {
      toast({
        title: "שגיאה בייצוא",
        description: error instanceof Error ? error.message : "לא ידוע",
        variant: "destructive",
      })
    } finally {
      setIsExporting(false)
    }
  }

  // Stats
  const stats = useMemo(() => {
    let totalRoles = 0
    let assignedRoles = 0
    let totalReplicas = 0

    for (const role of flatRoles) {
      totalRoles++
      totalReplicas += role.replicas_count
      if (role.casting) assignedRoles++
    }

    const pct = totalRoles > 0 ? Math.round((assignedRoles / totalRoles) * 100) : 0
    return { totalRoles, assignedRoles, totalReplicas, pct }
  }, [flatRoles])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-16">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={loadRoles} variant="outline">נסה שוב</Button>
      </div>
    )
  }

  const selectedCount = selectedRoleIds.size

  return (
    <div className="space-y-4">
      {/* Progress bar + stats */}
      <div className="flex items-center gap-6">
        <div className="flex-1">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-sm font-medium">
              {stats.assignedRoles} / {stats.totalRoles} תפקידים שובצו
            </span>
            <span className="text-sm text-muted-foreground">{stats.pct}%</span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${stats.pct}%` }}
            />
          </div>
        </div>
        <div className="flex items-center gap-4 text-sm text-muted-foreground flex-shrink-0">
          <div className="flex items-center gap-1.5">
            <Clapperboard className="h-4 w-4" />
            <span>{stats.totalReplicas.toLocaleString()} רפליקות</span>
          </div>
          {conflicts.length > 0 && (
            <div className="flex items-center gap-1.5">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>{conflicts.length} קונפליקטים</span>
            </div>
          )}
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="חיפוש תפקידים או שחקנים..."
            className="pr-10 h-9"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="unassigned-only"
            checked={showOnlyUnassigned}
            onCheckedChange={(c) => setShowOnlyUnassigned(c === true)}
          />
          <Label htmlFor="unassigned-only" className="text-sm cursor-pointer whitespace-nowrap">
            לא משובצים בלבד
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          className={`h-9 ${sortByReplicas ? "border-primary text-primary" : ""}`}
          onClick={() =>
            setSortByReplicas((prev) => (prev === "desc" ? "asc" : prev === "asc" ? null : "desc"))
          }
        >
          <ArrowUpDown className="h-3.5 w-3.5 ml-1.5" />
          רפליקות
          {sortByReplicas && (
            <span className="text-xs mr-1">({sortByReplicas === "desc" ? "גבוה" : "נמוך"})</span>
          )}
        </Button>

        <div className="flex-1" />

        {/* Export button (Excel import removed) */}
        <Button
          variant="outline"
          size="sm"
          className="h-9"
          onClick={handleExportCasting}
          disabled={isExporting || roles.length === 0}
        >
          {isExporting ? <Loader2 className="h-3.5 w-3.5 ml-1.5 animate-spin" /> : <Download className="h-3.5 w-3.5 ml-1.5" />}
          ייצוא לאקסל
        </Button>

        <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9">
              <Plus className="h-3.5 w-3.5 ml-1.5" />
              הוסף תפקיד
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>הוספת תפקיד חדש</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">שם התפקיד</Label>
                <Input
                  id="role-name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="לדוגמה: PADDINGTON"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRole()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-replicas">רפליקות משוערות</Label>
                <Input
                  id="role-replicas"
                  type="number"
                  min={0}
                  value={newRoleReplicas}
                  onChange={(e) => setNewRoleReplicas(Number(e.target.value))}
                />
              </div>
              <Button onClick={handleCreateRole} disabled={!newRoleName.trim() || isCreatingRole} className="w-full">
                {isCreatingRole ? <Loader2 className="h-4 w-4 ml-2 animate-spin" /> : null}
                {isCreatingRole ? "יוצר..." : "צור תפקיד"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Selection Action Bar */}
      {selectedCount > 0 && (
        <div className="flex items-center gap-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <span className="text-sm font-medium">
            {selectedCount} {selectedCount === 1 ? "תפקיד נבחר" : "תפקידים נבחרו"}
          </span>

          <div className="flex items-center gap-2 mr-auto">
            {showAssignSearch ? (
              <div className="flex items-center gap-2 w-[280px]">
                <ActorSearchAutocomplete
                  onSelect={handleBulkAssign}
                  disabled={isBulkAssigning}
                  placeholder="חיפוש שחקן לשיבוץ..."
                />
                {isBulkAssigning && <Loader2 className="h-4 w-4 animate-spin" />}
                <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowAssignSearch(false)}>
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            ) : (
              <Button
                size="sm"
                variant="outline"
                className="h-8"
                onClick={() => setShowAssignSearch(true)}
              >
                <UserPlus className="h-3.5 w-3.5 ml-1.5" />
                שבץ שחקן
              </Button>
            )}

            <Button
              size="sm"
              variant="outline"
              className="h-8 text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
            >
              {isBulkDeleting ? (
                <Loader2 className="h-3.5 w-3.5 ml-1.5 animate-spin" />
              ) : (
                <Trash2 className="h-3.5 w-3.5 ml-1.5" />
              )}
              {selectedCount === 1 ? "מחק תפקיד" : "מחק תפקידים"}
            </Button>
          </div>

          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={clearSelection}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground font-medium border-b border-border">
        <div className="min-w-[180px] max-w-[260px]">תפקיד</div>
        <div className="w-16 text-center flex-shrink-0">
          <div>רפליקות</div>
          <div className="text-[10px] font-semibold text-foreground">{stats.totalReplicas.toLocaleString()}</div>
        </div>
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 text-left">שחקן / שיבוץ</div>
      </div>

      {/* Roles list - FLAT */}
      {filteredRoles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {flatRoles.length === 0 ? (
            <div className="space-y-3">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-lg font-medium">אין תפקידים עדיין</p>
              <p className="text-sm">העלה תסריט לחילוץ תפקידים, או הוסף ידנית.</p>
            </div>
          ) : (
            <p>אין תפקידים התואמים את הסינון</p>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {filteredRoles.map((role) => (
              <RoleRow
                key={role.id}
                role={role}
                roleConflicts={conflictsByRoleId.get(role.id) || EMPTY_CONFLICTS}
                roleLookup={roleLookup}
                isSelected={selectedRoleIds.has(role.id)}
                onRoleNameClick={handleRoleNameClick}
                onUpdate={loadRoles}
              />
            ))}
          </div>
        </Card>
      )}

      {/* Selection hint */}
      {flatRoles.length > 0 && selectedCount === 0 && (
        <p className="text-xs text-muted-foreground/60 text-center">
          {"לחץ על שם תפקיד לבחירה/ביטול. לחץ על תפקידים נוספים לבחירה מרובה. Shift+לחיצה לבחירת טווח."}
        </p>
      )}
    </div>
  )
}
