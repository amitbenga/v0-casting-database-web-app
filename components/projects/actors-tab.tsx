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
import { useDebounce } from "@/hooks/use-debounce"
import type { CastingStatus, CASTING_STATUS_COLORS } from "@/lib/types"

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
  const [castings, setCastings] = useState<ActorWithRoles[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState("")
  const debouncedSearch = useDebounce(searchQuery, 300)
  const [viewMode, setViewMode] = useState<"table" | "cards">("table")
  const [sortByReplicas, setSortByReplicas] = useState<"asc" | "desc" | null>(null)

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

  const filteredCastings = useMemo(() => {
    const searchLower = debouncedSearch.toLowerCase()
    return castings
      .filter((c) => {
        if (!debouncedSearch) return true
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
  }, [castings, debouncedSearch, sortByReplicas])

  // Stats — computed once from source data, not re-derived on every render
  const { totalActors, totalRoles, totalReplicas } = useMemo(() => ({
    totalActors: castings.length,
    totalRoles: castings.reduce((sum: number, c) => sum + c.roles.length, 0),
    totalReplicas: castings.reduce(
      (sum: number, c) => sum + c.roles.reduce((s: number, r: any) => s + (r.replicas_planned || 0), 0),
      0
    ),
  }), [castings])

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

      {/* Content */}
      {viewMode === "table" ? (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
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
                        {casting.roles.map((role: any) => (
                          <Badge
                            key={role.role_id}
                            variant="outline"
                            className={STATUS_COLORS[role.status]}
                          >
                            {role.role_name}
                          </Badge>
                        ))}
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
          {filteredCastings.map((casting) => (
            <Card key={casting.actor.id} className="p-4">
              <div className="flex items-start gap-3">
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
                {casting.roles.map((role: any) => (
                  <div key={role.role_id} className="flex items-center justify-between">
                    <Badge
                      variant="outline"
                      className={STATUS_COLORS[role.status]}
                    >
                      {role.role_name}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {(role.replicas_planned || 0).toLocaleString()} רפליקות
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          ))}
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
