"use client"

import { useState, useEffect, useCallback } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Loader2, Users, LayoutGrid, List, ArrowUpDown, X } from "lucide-react"
import { getProjectActorsFromCastings, unassignActorFromRole } from "@/lib/actions/casting-actions"
import { useToast } from "@/hooks/use-toast"

type ActorWithRoles = Awaited<ReturnType<typeof getProjectActorsFromCastings>>[number]

interface ActorsTabProps {
  projectId: string
}

const STATUS_COLORS: Record<string, string> = {
  "באודישן": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "בליהוק": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "מלוהק": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
}

export function ActorsTab({ projectId }: ActorsTabProps) {
  const { toast } = useToast()
  const [castings, setCastings] = useState<ActorWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [sortByReplicas, setSortByReplicas] = useState<"asc" | "desc" | null>(null)
  const [selectedActorIds, setSelectedActorIds] = useState<Set<string>>(new Set())
  const [unassigningKey, setUnassigningKey] = useState<string | null>(null)

  const loadCastings = useCallback(async () => {
    try {
      setLoading(true)
      const data = await getProjectActorsFromCastings(projectId)
      setCastings(data)
    } catch (error) {
      console.error("Error loading castings:", error)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    loadCastings()
  }, [loadCastings])

  const filteredCastings = castings
    .filter((c) => {
      if (!searchQuery) return true
      const searchLower = searchQuery.toLowerCase()
      return (
        c.actor.name.toLowerCase().includes(searchLower) ||
        c.roles.some((r: any) => r.role_name?.toLowerCase().includes(searchLower))
      )
    })
    .sort((a, b) => {
      if (!sortByReplicas) return 0
      const totalA = a.roles.reduce((sum: number, r: any) => sum + (r.replicas_planned || 0), 0)
      const totalB = b.roles.reduce((sum: number, r: any) => sum + (r.replicas_planned || 0), 0)
      return sortByReplicas === "desc" ? totalB - totalA : totalA - totalB
    })

  // Stats
  const totalActors = castings.length
  const totalRoles = castings.reduce((sum: number, c) => sum + c.roles.length, 0)
  const totalReplicas = castings.reduce(
    (sum: number, c) => sum + c.roles.reduce((s: number, r: any) => s + (r.replicas_planned || 0), 0),
    0
  )

  // Selection handlers
  const handleToggleSelect = (actorId: string) => {
    setSelectedActorIds((prev) => {
      const next = new Set(prev)
      if (next.has(actorId)) {
        next.delete(actorId)
      } else {
        next.add(actorId)
      }
      return next
    })
  }

  const isAllSelected =
    filteredCastings.length > 0 &&
    filteredCastings.every((c) => selectedActorIds.has(c.actor.id))

  const handleSelectAll = () => {
    if (isAllSelected) {
      setSelectedActorIds(new Set())
    } else {
      setSelectedActorIds(new Set(filteredCastings.map((c) => c.actor.id)))
    }
  }

  const handleUnassignRole = async (roleId: string, actorId: string) => {
    const key = `${roleId}:${actorId}`
    setUnassigningKey(key)
    try {
      const result = await unassignActorFromRole(roleId, actorId)
      if (result.success) {
        toast({ title: "השיבוץ בוטל" })
        // Remove the role from local state optimistically
        setCastings((prev) =>
          prev
            .map((c) => {
              if (c.actor.id !== actorId) return c
              const newRoles = c.roles.filter((r: any) => r.role_id !== roleId)
              return { ...c, roles: newRoles }
            })
            .filter((c) => c.roles.length > 0)
        )
        // Remove from selection if actor has no more roles
        setCastings((prev) => {
          const actor = prev.find((c) => c.actor.id === actorId)
          if (!actor || actor.roles.length === 0) {
            setSelectedActorIds((s) => {
              const next = new Set(s)
              next.delete(actorId)
              return next
            })
          }
          return prev
        })
      } else {
        toast({ title: "שגיאה", description: result.error, variant: "destructive" })
      }
    } finally {
      setUnassigningKey(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (castings.length === 0) {
    return (
      <Card className="border-dashed">
        <div className="flex flex-col items-center justify-center py-12">
          <Users className="h-12 w-12 text-muted-foreground/50 mb-4" />
          <p className="text-muted-foreground text-center">
            אין שחקנים משובצים עדיין
          </p>
          <p className="text-sm text-muted-foreground text-center mt-1">
            שבץ שחקנים לתפקידים בטאב "תפקידים"
          </p>
        </div>
      </Card>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Bar */}
      <div className="flex items-center gap-6 p-4 bg-muted rounded-lg">
        <div>
          <p className="text-sm text-muted-foreground">שחקנים</p>
          <p className="text-lg font-semibold">{totalActors}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-sm text-muted-foreground">תפקידים</p>
          <p className="text-lg font-semibold">{totalRoles}</p>
        </div>
        <div className="h-8 w-px bg-border" />
        <div>
          <p className="text-sm text-muted-foreground">רפליקות מתוכננות</p>
          <p className="text-lg font-semibold">{totalReplicas.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative min-w-[200px] max-w-[300px]">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="חיפוש שחקן או תפקיד..."
              className="pr-10"
            />
          </div>

          <Button
            variant="outline"
            size="sm"
            className={sortByReplicas ? "border-primary text-primary" : ""}
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
        </div>

        <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
          <Button
            size="sm"
            variant={viewMode === "table" ? "secondary" : "ghost"}
            onClick={() => setViewMode("table")}
          >
            <List className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant={viewMode === "cards" ? "secondary" : "ghost"}
            onClick={() => setViewMode("cards")}
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Select All bar */}
      {filteredCastings.length > 0 && (
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Checkbox
              id="select-all-actors"
              checked={isAllSelected}
              onCheckedChange={handleSelectAll}
            />
            <label htmlFor="select-all-actors" className="text-sm cursor-pointer select-none">
              בחר הכל
              {selectedActorIds.size > 0 && (
                <span className="mr-1 text-muted-foreground">({selectedActorIds.size} נבחרו)</span>
              )}
            </label>
          </div>
        </div>
      )}

      {/* Content */}
      {viewMode === "table" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10" />
                <TableHead className="text-right">שחקן</TableHead>
                <TableHead className="text-right">תפקיד</TableHead>
                <TableHead className="text-right">רפליקות לתפקיד</TableHead>
                <TableHead className="text-right">סה"כ רפליקות</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCastings.map((casting) => {
                const actorTotalReplicas = casting.roles.reduce(
                  (sum: number, r: any) => sum + (r.replicas_planned || 0),
                  0
                )
                const isSelected = selectedActorIds.has(casting.actor.id)
                return (
                  <TableRow key={casting.actor.id} className={isSelected ? "bg-primary/5" : ""}>
                    <TableCell>
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => handleToggleSelect(casting.actor.id)}
                        aria-label={`בחר ${casting.actor.name}`}
                      />
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={casting.actor.image_url} alt={casting.actor.name} />
                          <AvatarFallback>{casting.actor.name.charAt(0)}</AvatarFallback>
                        </Avatar>
                        <p className="font-medium">{casting.actor.name}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-2">
                        {casting.roles.map((role: any) => {
                          const key = `${role.role_id}:${casting.actor.id}`
                          return (
                            <Badge
                              key={role.role_id}
                              variant="outline"
                              className={`${STATUS_COLORS[role.status]} flex items-center gap-1 pr-1`}
                            >
                              {role.role_name}
                              <button
                                onClick={() => handleUnassignRole(role.role_id, casting.actor.id)}
                                disabled={unassigningKey === key}
                                className="hover:text-destructive transition-colors ml-0.5"
                                title="הסר מתפקיד זה"
                              >
                                {unassigningKey === key ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3" />
                                )}
                              </button>
                            </Badge>
                          )
                        })}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {casting.roles.map((role: any) => (
                          <span key={role.role_id} className="text-sm text-muted-foreground">
                            {role.role_name}: {(role.replicas_planned || 0).toLocaleString()}
                          </span>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold">{actorTotalReplicas.toLocaleString()}</span>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredCastings.map((casting) => {
            const isSelected = selectedActorIds.has(casting.actor.id)
            return (
              <Card key={casting.actor.id} className={`p-4 ${isSelected ? "ring-2 ring-primary" : ""}`}>
                <div className="flex items-start gap-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => handleToggleSelect(casting.actor.id)}
                    aria-label={`בחר ${casting.actor.name}`}
                    className="mt-1"
                  />
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={casting.actor.image_url} alt={casting.actor.name} />
                    <AvatarFallback>{casting.actor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{casting.actor.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {casting.roles.length} תפקידים |{" "}
                      {casting.roles
                        .reduce((sum: number, r: any) => sum + (r.replicas_planned || 0), 0)
                        .toLocaleString()}{" "}
                      רפליקות
                    </p>
                  </div>
                </div>
                <div className="mt-3 space-y-2">
                  {casting.roles.map((role: any) => {
                    const key = `${role.role_id}:${casting.actor.id}`
                    return (
                      <div key={role.role_id} className="flex items-center justify-between">
                        <Badge
                          variant="outline"
                          className={`${STATUS_COLORS[role.status]} flex items-center gap-1 pr-1`}
                        >
                          {role.role_name}
                          <button
                            onClick={() => handleUnassignRole(role.role_id, casting.actor.id)}
                            disabled={unassigningKey === key}
                            className="hover:text-destructive transition-colors ml-0.5"
                            title="הסר מתפקיד זה"
                          >
                            {unassigningKey === key ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <X className="h-3 w-3" />
                            )}
                          </button>
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {(role.replicas_planned || 0).toLocaleString()} רפליקות
                        </span>
                      </div>
                    )
                  })}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {filteredCastings.length === 0 && searchQuery && (
        <div className="text-center py-12 text-muted-foreground">
          לא נמצאו תוצאות עבור "{searchQuery}"
        </div>
      )}
    </div>
  )
}
