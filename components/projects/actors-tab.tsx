"use client"

import { useState, useEffect, useMemo } from "react"
import { Card } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Search, Loader2, Users, LayoutGrid, List, ArrowUpDown } from "lucide-react"
import { getProjectActorsFromCastings } from "@/lib/actions/casting-actions"

type ActorWithRoles = Awaited<ReturnType<typeof getProjectActorsFromCastings>>[number]

interface ActorsTabProps {
  projectId: string
}

const STATUS_COLORS: Record<string, string> = {
  "באודישן": "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  "בליהוק": "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  "מלוהק": "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
}

type SortField = "name" | "roles" | "total_replicas"
type SortDir = "asc" | "desc"

export function ActorsTab({ projectId }: ActorsTabProps) {
  const [castings, setCastings] = useState<ActorWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [sortField, setSortField] = useState<SortField>("total_replicas")
  const [sortDir, setSortDir] = useState<SortDir>("desc")

  useEffect(() => {
    async function loadCastings() {
      try {
        setLoading(true)
        const data = await getProjectActorsFromCastings(projectId)
        setCastings(data)
      } catch (error) {
        console.error("Error loading castings:", error)
      } finally {
        setLoading(false)
      }
    }

    loadCastings()
  }, [projectId])

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir((prev) => (prev === "desc" ? "asc" : "desc"))
    } else {
      setSortField(field)
      setSortDir("desc")
    }
  }

  const getActorTotalReplicas = (c: ActorWithRoles) =>
    c.roles.reduce((sum, r) => sum + (r.replicas_planned || 0), 0)

  const filteredCastings = useMemo(() => {
    let result = castings.filter((c) => {
      if (!searchQuery) return true
      const searchLower = searchQuery.toLowerCase()
      return (
        c.actor.name.toLowerCase().includes(searchLower) ||
        c.roles.some((r) => r.role_name?.toLowerCase().includes(searchLower))
      )
    })

    result.sort((a, b) => {
      let diff = 0
      switch (sortField) {
        case "name":
          diff = a.actor.name.localeCompare(b.actor.name, "he")
          break
        case "roles":
          diff = a.roles.length - b.roles.length
          break
        case "total_replicas":
          diff = getActorTotalReplicas(a) - getActorTotalReplicas(b)
          break
      }
      return sortDir === "desc" ? -diff : diff
    })

    return result
  }, [castings, searchQuery, sortField, sortDir])

  // Stats
  const totalActors = castings.length
  const totalRoles = castings.reduce((sum, c) => sum + c.roles.length, 0)
  const totalReplicas = castings.reduce(
    (sum, c) => sum + getActorTotalReplicas(c),
    0
  )

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
            {"שבץ שחקנים לתפקידים בטאב \"תפקידים\""}
          </p>
        </div>
      </Card>
    )
  }

  const SortButton = ({ field, label }: { field: SortField; label: string }) => (
    <button
      type="button"
      className="flex items-center gap-1 hover:text-foreground transition-colors cursor-pointer"
      onClick={() => toggleSort(field)}
    >
      {label}
      <ArrowUpDown className={`h-3 w-3 ${sortField === field ? "text-primary" : "text-muted-foreground/50"}`} />
    </button>
  )

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
          <p className="text-sm text-muted-foreground">סה"כ רפליקות</p>
          <p className="text-lg font-semibold">{totalReplicas.toLocaleString()}</p>
        </div>
      </div>

      {/* Filters & View Toggle */}
      <div className="flex items-center justify-between gap-4">
        <div className="relative flex-1 max-w-[300px]">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="חיפוש שחקן או תפקיד..."
            className="pr-10"
          />
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

      {/* Content */}
      {viewMode === "table" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-right">
                  <SortButton field="name" label="שחקן" />
                </TableHead>
                <TableHead className="text-right">
                  <SortButton field="roles" label="תפקידים" />
                </TableHead>
                <TableHead className="text-right">רפליקות לפי תפקיד</TableHead>
                <TableHead className="text-right">
                  <SortButton field="total_replicas" label="סה&quot;כ רפליקות" />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCastings.map((casting) => {
                const actorTotal = getActorTotalReplicas(casting)
                return (
                  <TableRow key={casting.actor.id}>
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
                        {casting.roles.map((role) => (
                          <Badge
                            key={role.role_id}
                            variant="outline"
                            className={STATUS_COLORS[role.status] || ""}
                          >
                            {role.role_name}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        {casting.roles.map((role) => (
                          <div key={role.role_id} className="flex items-center gap-2 text-sm">
                            <span className="text-muted-foreground truncate max-w-[120px]">{role.role_name}:</span>
                            <span className="font-medium">{(role.replicas_planned || 0).toLocaleString()}</span>
                          </div>
                        ))}
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-semibold text-base">{actorTotal.toLocaleString()}</span>
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
            const actorTotal = getActorTotalReplicas(casting)
            return (
              <Card key={casting.actor.id} className="p-4">
                <div className="flex items-start gap-3">
                  <Avatar className="h-12 w-12">
                    <AvatarImage src={casting.actor.image_url} alt={casting.actor.name} />
                    <AvatarFallback>{casting.actor.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{casting.actor.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {casting.roles.length} תפקידים | {actorTotal.toLocaleString()} רפליקות
                    </p>
                  </div>
                </div>
                <div className="mt-4 space-y-2">
                  {casting.roles.map((role) => (
                    <div key={role.role_id} className="flex items-center justify-between">
                      <Badge
                        variant="outline"
                        className={STATUS_COLORS[role.status] || ""}
                      >
                        {role.role_name}
                      </Badge>
                      <span className="text-sm text-muted-foreground">
                        {(role.replicas_planned || 0).toLocaleString()} רפליקות
                      </span>
                    </div>
                  ))}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {filteredCastings.length === 0 && searchQuery && (
        <div className="text-center py-12 text-muted-foreground">
          {"לא נמצאו תוצאות עבור"} &quot;{searchQuery}&quot;
        </div>
      )}
    </div>
  )
}
