"use client"

import { useState, useEffect, useMemo } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Label } from "@/components/ui/label"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import { Search, ChevronDown, ChevronLeft, ArrowUpDown, Loader2 } from "lucide-react"
import { RoleCastingCard } from "./role-casting-card"
import { getProjectRolesWithCasting } from "@/lib/projects/api"
import type { ProjectRoleWithCasting, RolesFilterState } from "@/lib/projects/types"

interface RolesTabProps {
  projectId: string
}

export function RolesTab({ projectId }: RolesTabProps) {
  const [roles, setRoles] = useState<ProjectRoleWithCasting[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedRoles, setExpandedRoles] = useState<Set<string>>(new Set())
  const [filters, setFilters] = useState<RolesFilterState>({
    search: "",
    showOnlyUnassigned: false,
    sortByReplicas: null,
  })

  const loadRoles = async () => {
    try {
      setLoading(true)
      setError(null)
      const response = await getProjectRolesWithCasting(projectId)
      setRoles(response.roles)
      
      // Expand all parent roles by default
      const parentIds = response.roles
        .filter((r) => r.children && r.children.length > 0)
        .map((r) => r.id)
      setExpandedRoles(new Set(parentIds))
    } catch (err) {
      setError("שגיאה בטעינת התפקידים")
      console.error("Error loading roles:", err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadRoles()
  }, [projectId])

  const toggleExpanded = (roleId: string) => {
    setExpandedRoles((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) {
        next.delete(roleId)
      } else {
        next.add(roleId)
      }
      return next
    })
  }

  // Filter and sort roles
  const filteredRoles = useMemo(() => {
    let result = [...roles]

    // Search filter
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      result = result.filter((role) => {
        const matchesParent = role.role_name.toLowerCase().includes(searchLower)
        const matchesChild = role.children?.some((child) =>
          child.role_name.toLowerCase().includes(searchLower)
        )
        return matchesParent || matchesChild
      })
    }

    // Unassigned filter
    if (filters.showOnlyUnassigned) {
      result = result.filter((role) => {
        const parentUnassigned = !role.casting
        const hasUnassignedChild = role.children?.some((child) => !child.casting)
        return parentUnassigned || hasUnassignedChild
      })
    }

    // Sort by replicas
    if (filters.sortByReplicas) {
      result.sort((a, b) => {
        const diff = b.replicas_count - a.replicas_count
        return filters.sortByReplicas === "desc" ? diff : -diff
      })
    }

    return result
  }, [roles, filters])

  // Stats
  const stats = useMemo(() => {
    let totalRoles = 0
    let assignedRoles = 0
    let totalReplicas = 0
    let assignedReplicas = 0

    const countRole = (role: ProjectRoleWithCasting) => {
      totalRoles++
      totalReplicas += role.replicas_count
      if (role.casting) {
        assignedRoles++
        assignedReplicas += role.replicas_count
      }
      role.children?.forEach(countRole)
    }

    roles.forEach(countRole)

    return { totalRoles, assignedRoles, totalReplicas, assignedReplicas }
  }, [roles])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-destructive mb-4">{error}</p>
        <Button onClick={loadRoles} variant="outline">
          נסה שוב
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center gap-6 p-4 bg-muted rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">תפקידים</p>
          <p className="text-lg font-semibold">
            {stats.assignedRoles} / {stats.totalRoles}
          </p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-sm text-muted-foreground">רפליקות משובצות</p>
          <p className="text-lg font-semibold">
            {stats.assignedReplicas.toLocaleString()} / {stats.totalReplicas.toLocaleString()}
          </p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-sm text-muted-foreground">אחוז שיבוץ</p>
          <p className="text-lg font-semibold">
            {stats.totalRoles > 0
              ? Math.round((stats.assignedRoles / stats.totalRoles) * 100)
              : 0}
            %
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-4 flex-wrap">
        <div className="relative flex-1 min-w-[200px] max-w-[300px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="חיפוש תפקיד..."
            className="pr-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Checkbox
            id="show-unassigned"
            checked={filters.showOnlyUnassigned}
            onCheckedChange={(checked) =>
              setFilters((f) => ({ ...f, showOnlyUnassigned: checked === true }))
            }
          />
          <Label htmlFor="show-unassigned" className="text-sm cursor-pointer">
            רק לא משובצים
          </Label>
        </div>

        <Button
          variant="outline"
          size="sm"
          onClick={() =>
            setFilters((f) => ({
              ...f,
              sortByReplicas: f.sortByReplicas === "desc" ? "asc" : "desc",
            }))
          }
          className={filters.sortByReplicas ? "border-primary" : ""}
        >
          <ArrowUpDown className="h-4 w-4 ml-2" />
          מיון לפי רפליקות
          {filters.sortByReplicas && (
            <span className="mr-1">({filters.sortByReplicas === "desc" ? "יורד" : "עולה"})</span>
          )}
        </Button>
      </div>

      {/* Roles List */}
      {filteredRoles.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          {roles.length === 0 ? "אין תפקידים בפרויקט" : "לא נמצאו תפקידים מתאימים לחיפוש"}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredRoles.map((role) => {
            const hasChildren = role.children && role.children.length > 0
            const isExpanded = expandedRoles.has(role.id)

            if (hasChildren) {
              return (
                <Collapsible
                  key={role.id}
                  open={isExpanded}
                  onOpenChange={() => toggleExpanded(role.id)}
                >
                  <div className="space-y-2">
                    <CollapsibleTrigger asChild>
                      <div className="flex items-center gap-2 cursor-pointer hover:bg-muted p-2 rounded-lg transition-colors">
                        {isExpanded ? (
                          <ChevronDown className="h-5 w-5 text-muted-foreground" />
                        ) : (
                          <ChevronLeft className="h-5 w-5 text-muted-foreground" />
                        )}
                        <span className="font-semibold">{role.role_name}</span>
                        <span className="text-sm text-muted-foreground">
                          ({role.children!.length} וריאנטים, {role.replicas_count} רפליקות)
                        </span>
                      </div>
                    </CollapsibleTrigger>

                    <CollapsibleContent className="space-y-2">
                      {/* Parent role card if it has its own casting */}
                      {role.casting && (
                        <RoleCastingCard role={role} onUpdate={loadRoles} />
                      )}
                      
                      {/* Child roles */}
                      {role.children?.map((child) => (
                        <RoleCastingCard
                          key={child.id}
                          role={child}
                          isChild
                          onUpdate={loadRoles}
                        />
                      ))}
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              )
            }

            // Regular role without children
            return (
              <RoleCastingCard key={role.id} role={role} onUpdate={loadRoles} />
            )
          })}
        </div>
      )}
    </div>
  )
}
