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
  ChevronDown,
  ChevronLeft,
  ArrowUpDown,
  Loader2,
  Plus,
  UserPlus,
  X,
  RefreshCw,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Circle,
  Users,
  Clapperboard,
  Download,
  Upload,
} from "lucide-react"
import { ActorSearchAutocomplete } from "./actor-search-autocomplete"
import {
  exportCastingToExcel,
  importCastingFromExcel,
  exportCastingTemplate,
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

// ---------- Conflict Tooltip ----------

function ConflictTooltip({
  roleId,
  conflicts,
  allRoles,
}: {
  roleId: string
  conflicts: RoleConflict[]
  allRoles: ProjectRoleWithCasting[]
}) {
  const roleConflicts = conflicts.filter(
    (c) => c.role_id_a === roleId || c.role_id_b === roleId
  )
  if (roleConflicts.length === 0) return null

  // Build a flat lookup of all roles including children
  const roleLookup = new Map<string, string>()
  for (const r of allRoles) {
    roleLookup.set(r.id, r.role_name)
    r.children?.forEach((c) => roleLookup.set(c.id, c.role_name))
  }

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
            קונפליקטים ({roleConflicts.length})
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
  conflicts: RoleConflict[]
  allRoles: ProjectRoleWithCasting[]
  isChild?: boolean
  onUpdate: () => void
}

function RoleRow({ role, conflicts, allRoles, isChild = false, onUpdate }: RoleRowProps) {
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

  const handleDeleteRole = async () => {
    if (!confirm(`למחוק את התפקיד "${role.role_name}"?`)) return
    setIsUpdating(true)
    try {
      const result = await deleteRole(role.id)
      if (result.success) {
        toast({ title: "התפקיד נמחק" })
        onUpdate()
      }
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
        hover:bg-muted/40 transition-colors
        ${isChild ? "pr-14 bg-muted/10" : ""}
        ${isCasted ? "bg-transparent" : isChild ? "bg-muted/10" : "bg-muted/20"}
      `}
    >
      {/* Status indicator */}
      <div className="flex-shrink-0">
        {isCasted ? (
          <CheckCircle2 className="h-4 w-4 text-green-500" />
        ) : (
          <Circle className="h-4 w-4 text-muted-foreground/40" />
        )}
      </div>

      {/* Role name */}
      <div className="flex items-center gap-2 min-w-[180px] max-w-[260px]">
        <span className={`text-sm font-medium truncate ${isCasted ? "text-foreground" : "text-muted-foreground"} ${isChild ? "text-xs" : ""}`}>
          {role.role_name}
        </span>
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
      <ConflictTooltip roleId={role.id} conflicts={conflicts} allRoles={allRoles} />

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
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
              onClick={() => setShowSearch(true)}
            >
              <UserPlus className="h-3.5 w-3.5 ml-1.5" />
              שיבוץ
            </Button>
            {role.source === "manual" && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity text-destructive hover:text-destructive"
                onClick={handleDeleteRole}
                disabled={isUpdating}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
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
  const [roles, setRoles] = useState<ProjectRoleWithCasting[]>([])
  const [conflicts, setConflicts] = useState<RoleConflict[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

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
  const [importError, setImportError] = useState("")

  const loadRoles = useCallback(async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getProjectRolesWithCasting(projectId)
      setRoles(response.roles)
      setConflicts(response.conflicts)

      // Auto-expand all groups
      const parentIds = response.roles
        .filter((r) => r.children && r.children.length > 0)
        .map((r) => r.id)
      setExpandedGroups(new Set(parentIds))
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

  const handleCreateRole = async () => {
    if (!newRoleName.trim()) return
    setIsCreatingRole(true)
    try {
      const result = await createManualRole(projectId, newRoleName, newRoleReplicas)
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

  // Export to Excel
  const handleExportCasting = async () => {
    if (roles.length === 0) {
      toast({ title: "אין תפקידים לייצוא", variant: "destructive" })
      return
    }
    
    setIsExporting(true)
    try {
      // Build actors map from roles
      const actorsMap = new Map()
      roles.forEach((role) => {
        if (role.assigned_actor && role.assigned_actor_id) {
          actorsMap.set(role.assigned_actor_id, role.assigned_actor)
        }
      })

      await exportCastingToExcel(roles, `project-${projectId}`, actorsMap)
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

  // Import from Excel
  const handleImportCasting = async (file: File) => {
    setImportError("")
    try {
      const { roles: importedRoles, warnings } = await importCastingFromExcel(file)

      if (importedRoles.length === 0) {
        setImportError("לא נחלצו תפקידים מהקובץ")
        return
      }

      // Create roles
      let created = 0
      for (const roleData of importedRoles) {
        const result = await createManualRole(
          projectId,
          roleData.role_name,
          roleData.replicas_count
        )
        if (result.success) created++
      }

      toast({
        title: `${created} תפקידים נוצרו`,
        description: warnings.length > 0 ? `${warnings.length} אזהרות` : undefined,
      })

      loadRoles()
    } catch (error) {
      const msg = error instanceof Error ? error.message : "שגיאה בייבוא"
      setImportError(msg)
      toast({ title: "שגיאה בייבוא", description: msg, variant: "destructive" })
    }
  }

  // Export template
  const handleExportTemplate = () => {
    try {
      exportCastingTemplate(`project-${projectId}`)
      toast({ title: "דוגמה יוצאת בהצלחה" })
    } catch (error) {
      toast({
        title: "שגיאה",
        description: error instanceof Error ? error.message : "לא ידוע",
        variant: "destructive",
      })
    }
  }
    } finally {
      setIsCreatingRole(false)
    }
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Filter + sort
  const filteredRoles = useMemo(() => {
    let result = [...roles]

    if (search) {
      const q = search.toLowerCase()
      result = result.filter((r) => {
        const matchesParent = r.role_name.toLowerCase().includes(q)
        const matchesChild = r.children?.some((c) => c.role_name.toLowerCase().includes(q))
        const matchesActor = r.casting?.actor?.full_name?.toLowerCase().includes(q)
        const matchesChildActor = r.children?.some((c) => c.casting?.actor?.full_name?.toLowerCase().includes(q))
        return matchesParent || matchesChild || matchesActor || matchesChildActor
      })
    }

    if (showOnlyUnassigned) {
      result = result.filter((r) => {
        const parentUnassigned = !r.casting
        const hasUnassignedChild = r.children?.some((c) => !c.casting)
        return parentUnassigned || hasUnassignedChild
      })
    }

    if (sortByReplicas) {
      result.sort((a, b) => {
        const diff = b.replicas_count - a.replicas_count
        return sortByReplicas === "desc" ? diff : -diff
      })
    }

    return result
  }, [roles, search, showOnlyUnassigned, sortByReplicas])

  // Stats
  const stats = useMemo(() => {
    let totalRoles = 0
    let assignedRoles = 0
    let totalReplicas = 0

    const count = (role: ProjectRoleWithCasting) => {
      totalRoles++
      totalReplicas += role.replicas_count
      if (role.casting) assignedRoles++
      role.children?.forEach(count)
    }
    roles.forEach(count)

    const pct = totalRoles > 0 ? Math.round((assignedRoles / totalRoles) * 100) : 0
    return { totalRoles, assignedRoles, totalReplicas, pct }
  }, [roles])

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

        {/* Export/Import buttons */}
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

        <Dialog>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="h-9">
              <Upload className="h-3.5 w-3.5 ml-1.5" />
              ייבוא מאקסל
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>ייבוא תפקידים מאקסל</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              {importError && (
                <div className="p-3 bg-destructive/10 text-destructive text-sm rounded">
                  {importError}
                </div>
              )}
              <div className="border-2 border-dashed rounded-lg p-6 text-center">
                <input
                  type="file"
                  accept=".xlsx,.xls"
                  onChange={(e) => {
                    const file = e.currentTarget.files?.[0]
                    if (file) {
                      handleImportCasting(file)
                    }
                  }}
                  className="w-full"
                />
              </div>
              <Button variant="ghost" onClick={handleExportTemplate} className="w-full">
                הורד דוגמה
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground font-medium border-b border-border">
        <div className="w-4 flex-shrink-0" />
        <div className="min-w-[180px] max-w-[260px]">תפקיד</div>
        <div className="w-16 text-center flex-shrink-0">רפליקות</div>
        <div className="w-8 flex-shrink-0" />
        <div className="flex-1 text-left">שחקן / שיבוץ</div>
      </div>

      {/* Roles list */}
      {filteredRoles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {roles.length === 0 ? (
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
            {filteredRoles.map((role) => {
              const hasChildren = role.children && role.children.length > 0
              const isExpanded = expandedGroups.has(role.id)

              if (hasChildren) {
                // Parent role WITH variants
                // The parent itself is castable (it's the main version)
                // Children are variant versions (e.g. YOUNG ALDRIC)
                return (
                  <div key={role.id}>
                    {/* Parent row - castable + expandable */}
                    <div className="flex items-center">
                      {/* Expand toggle */}
                      <button
                        onClick={() => toggleGroup(role.id)}
                        className="flex items-center justify-center w-10 h-full py-2.5 hover:bg-muted/60 transition-colors flex-shrink-0"
                        aria-label={isExpanded ? "סגור גרסאות" : "פתח גרסאות"}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>
                      {/* The actual castable row for the parent */}
                      <div className="flex-1">
                        <RoleRow role={role} conflicts={conflicts} allRoles={roles} onUpdate={loadRoles} />
                      </div>
                    </div>

                    {/* Children (variants) */}
                    {isExpanded && (
                      <div className="border-r-2 border-primary/20 mr-5">
                        {role.children!.map((child) => (
                          <RoleRow
                            key={child.id}
                            role={child}
                            conflicts={conflicts}
                            allRoles={roles}
                            isChild
                            onUpdate={loadRoles}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )
              }

              // Simple role without variants
              return <RoleRow key={role.id} role={role} conflicts={conflicts} allRoles={roles} onUpdate={loadRoles} />
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
