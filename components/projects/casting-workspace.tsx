"use client"

import { useState, useEffect, useMemo, useCallback } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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
  FileText,
  Play,
  Trash2,
  AlertTriangle,
  Filter,
  CheckCircle2,
  Circle,
  Users,
  Clapperboard,
} from "lucide-react"
import { ActorSearchAutocomplete } from "./actor-search-autocomplete"
import {
  getProjectRolesWithCasting,
  createManualRole,
  assignActorToRole,
  unassignActorFromRole,
  updateCastingStatus,
  updateCastingDetails,
  deleteRole,
} from "@/lib/actions/casting-actions"
import type { ProjectRoleWithCasting, RoleConflict, CastingStatus } from "@/lib/types"
import { CASTING_STATUS_LIST, CASTING_STATUS_COLORS } from "@/lib/types"
import { useToast } from "@/hooks/use-toast"

// ---------- Sub-components ----------

interface RoleRowProps {
  role: ProjectRoleWithCasting
  conflicts: RoleConflict[]
  isChild?: boolean
  onUpdate: () => void
}

function RoleRow({ role, conflicts, isChild = false, onUpdate }: RoleRowProps) {
  const { toast } = useToast()
  const [showSearch, setShowSearch] = useState(false)
  const [isAssigning, setIsAssigning] = useState(false)
  const [isUpdating, setIsUpdating] = useState(false)

  const roleConflicts = conflicts.filter(
    (c) => c.role_id_a === role.id || c.role_id_b === role.id
  )

  const handleAssignActor = async (actor: { id: string; name: string; image_url?: string }) => {
    setIsAssigning(true)
    try {
      const result = await assignActorToRole(role.id, actor.id)
      if (!result.success) {
        toast({
          title: "Casting Error",
          description: result.message_he || result.error || "Error assigning actor",
          variant: "destructive",
        })
        return
      }
      toast({ title: `${actor.name} assigned to ${role.role_name}` })
      setShowSearch(false)
      onUpdate()
    } catch {
      toast({ title: "Error", description: "Failed to assign actor", variant: "destructive" })
    } finally {
      setIsAssigning(false)
    }
  }

  const handleUnassign = async () => {
    setIsUpdating(true)
    try {
      const result = await unassignActorFromRole(role.id)
      if (result.success) {
        toast({ title: `${role.role_name} is now unassigned` })
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
    if (!confirm(`Delete role "${role.role_name}"?`)) return
    setIsUpdating(true)
    try {
      const result = await deleteRole(role.id)
      if (result.success) {
        toast({ title: "Role deleted" })
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
        ${isChild ? "pr-12" : ""}
        ${isCasted ? "bg-transparent" : "bg-muted/20"}
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

      {/* Role name + replicas */}
      <div className="flex items-center gap-2 min-w-[180px] max-w-[240px]">
        <span className={`text-sm font-medium truncate ${isCasted ? "text-foreground" : "text-muted-foreground"}`}>
          {role.role_name}
        </span>
        {role.source === "script" && (
          <Badge variant="outline" className="text-[10px] px-1 py-0 h-4 flex-shrink-0">
            script
          </Badge>
        )}
      </div>

      {/* Replicas count */}
      <div className="flex-shrink-0 w-16 text-center">
        <span className="text-xs text-muted-foreground">{role.replicas_count}</span>
      </div>

      {/* Casting section - takes remaining space */}
      <div className="flex-1 flex items-center justify-end gap-2">
        {role.casting ? (
          <>
            {/* Assigned actor */}
            <div className="flex items-center gap-2 px-2 py-1 bg-muted/60 rounded-md">
              <Avatar className="h-6 w-6">
                <AvatarImage src={role.casting.actor?.image_url} alt={role.casting.actor?.full_name} />
                <AvatarFallback className="text-[10px]">
                  {(role.casting.actor?.full_name || "?").charAt(0)}
                </AvatarFallback>
              </Avatar>
              <span className="text-sm font-medium max-w-[140px] truncate">
                {role.casting.actor?.full_name || "Actor"}
              </span>
            </div>

            {/* Status */}
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

            {/* Actions - visible on hover */}
            <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowSearch(true)} disabled={isUpdating} title="Replace">
                <RefreshCw className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" onClick={handleUnassign} disabled={isUpdating} title="Unassign">
                <X className="h-3.5 w-3.5" />
              </Button>
            </div>
          </>
        ) : showSearch ? (
          <div className="flex items-center gap-2 w-[280px]">
            <ActorSearchAutocomplete
              onSelect={handleAssignActor}
              disabled={isAssigning}
              placeholder="Search actor..."
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
              Assign
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

      {/* Conflict indicator */}
      {roleConflicts.length > 0 && (
        <div className="flex-shrink-0" title={`${roleConflicts.length} conflict(s)`}>
          <AlertTriangle className="h-4 w-4 text-amber-500" />
        </div>
      )}
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
      setError("Error loading roles")
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
      const result = await createManualRole(projectId, newRoleName.trim(), undefined, newRoleReplicas)
      if (result.success) {
        toast({ title: `Role "${newRoleName}" created` })
        setShowAddRole(false)
        setNewRoleName("")
        setNewRoleReplicas(0)
        loadRoles()
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
        return matchesParent || matchesChild || matchesActor
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
        <Button onClick={loadRoles} variant="outline">Try again</Button>
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
              {stats.assignedRoles} / {stats.totalRoles} roles assigned
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
            <span>{stats.totalReplicas.toLocaleString()} replicas</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>{conflicts.length} conflicts</span>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search roles or actors..."
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
            Unassigned only
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
          Replicas
          {sortByReplicas && (
            <span className="text-xs mr-1">({sortByReplicas === "desc" ? "high" : "low"})</span>
          )}
        </Button>

        <div className="flex-1" />

        <Dialog open={showAddRole} onOpenChange={setShowAddRole}>
          <DialogTrigger asChild>
            <Button size="sm" className="h-9">
              <Plus className="h-3.5 w-3.5 ml-1.5" />
              Add Role
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New Role</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="role-name">Role Name</Label>
                <Input
                  id="role-name"
                  value={newRoleName}
                  onChange={(e) => setNewRoleName(e.target.value)}
                  placeholder="e.g. PADDINGTON"
                  onKeyDown={(e) => e.key === "Enter" && handleCreateRole()}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="role-replicas">Estimated Replicas</Label>
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
                {isCreatingRole ? "Creating..." : "Create Role"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Column headers */}
      <div className="flex items-center gap-3 px-4 py-2 text-xs text-muted-foreground font-medium border-b border-border">
        <div className="w-4 flex-shrink-0" />
        <div className="min-w-[180px] max-w-[240px]">Role</div>
        <div className="w-16 text-center flex-shrink-0">Replicas</div>
        <div className="flex-1 text-left">Actor / Assignment</div>
        <div className="w-4 flex-shrink-0" />
      </div>

      {/* Roles list */}
      {filteredRoles.length === 0 ? (
        <div className="text-center py-16 text-muted-foreground">
          {roles.length === 0 ? (
            <div className="space-y-3">
              <Users className="h-12 w-12 mx-auto text-muted-foreground/40" />
              <p className="text-lg font-medium">No roles yet</p>
              <p className="text-sm">Upload a script to extract roles, or add them manually.</p>
            </div>
          ) : (
            <p>No roles match current filters</p>
          )}
        </div>
      ) : (
        <Card className="overflow-hidden">
          <div className="divide-y divide-border/50">
            {filteredRoles.map((role) => {
              const hasChildren = role.children && role.children.length > 0
              const isExpanded = expandedGroups.has(role.id)

              if (hasChildren) {
                return (
                  <Collapsible key={role.id} open={isExpanded} onOpenChange={() => toggleGroup(role.id)}>
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted/40 transition-colors bg-muted/20">
                        <div className="flex-shrink-0">
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronLeft className="h-4 w-4 text-muted-foreground" />
                          )}
                        </div>
                        <span className="font-semibold text-sm">{role.role_name}</span>
                        <Badge variant="secondary" className="text-[10px] h-5">
                          {role.children!.length} variants
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {role.replicas_count} replicas
                        </span>
                      </div>
                    </CollapsibleTrigger>
                    <CollapsibleContent>
                      {/* Parent casting row if it has its own */}
                      {role.casting && (
                        <RoleRow role={role} conflicts={conflicts} onUpdate={loadRoles} />
                      )}
                      {role.children?.map((child) => (
                        <RoleRow key={child.id} role={child} conflicts={conflicts} isChild onUpdate={loadRoles} />
                      ))}
                    </CollapsibleContent>
                  </Collapsible>
                )
              }

              return <RoleRow key={role.id} role={role} conflicts={conflicts} onUpdate={loadRoles} />
            })}
          </div>
        </Card>
      )}
    </div>
  )
}
