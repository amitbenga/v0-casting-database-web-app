import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import {
  calculatePercentRecorded,
  calculateTotals,
  fetchScriptLinesForProgress,
  hasAssignedActor,
  isValidProjectId,
  type ScriptLineProgressRow,
} from "@/lib/progress/server"
import type { ActorProgressResponseItem, ActorsProgressResponse } from "@/lib/progress/types"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ projectId: string }>
}

interface ActorLookupRow {
  id: string
  full_name: string
}

function jsonNoStore(payload: unknown, status: number = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

function groupByActor(rows: ScriptLineProgressRow[]): Map<string, ScriptLineProgressRow[]> {
  const grouped = new Map<string, ScriptLineProgressRow[]>()

  for (const row of rows) {
    if (!hasAssignedActor(row.actor_id)) continue
    const existing = grouped.get(row.actor_id) ?? []
    existing.push(row)
    grouped.set(row.actor_id, existing)
  }

  return grouped
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { projectId } = await params
  const normalizedProjectId = projectId?.trim()

  if (!isValidProjectId(normalizedProjectId)) {
    return jsonNoStore({ error: "מזהה פרויקט לא תקין" }, 400)
  }

  try {
    await requireAuth()

    const { rows } = await fetchScriptLinesForProgress(normalizedProjectId)
    const groupedByActor = groupByActor(rows)
    const actorIds = Array.from(groupedByActor.keys())

    const supabase = await createClient()
    let actorNameById = new Map<string, string>()

    if (actorIds.length > 0) {
      const { data: actors, error: actorsError } = await supabase
        .from("actors")
        .select("id, full_name")
        .in("id", actorIds)

      if (actorsError) throw actorsError

      actorNameById = new Map<string, string>(
        ((actors ?? []) as ActorLookupRow[]).map((actor) => [actor.id, actor.full_name])
      )
    }

    const payload: ActorsProgressResponse = Array.from(groupedByActor.entries())
      .map(([actorId, actorRows]) => {
        const totals = calculateTotals(actorRows)
        const item: ActorProgressResponseItem = {
          actorId,
          actorName: actorNameById.get(actorId) ?? "שחקן ללא שם",
          totals,
          percentRecorded: calculatePercentRecorded(totals.recorded, totals.total),
        }
        return item
      })
      .sort((a, b) => b.percentRecorded - a.percentRecorded)

    return jsonNoStore(payload, 200)
  } catch (error) {
    console.error("GET /api/projects/[projectId]/progress/actors failed:", error)
    return jsonNoStore({ error: "שגיאה בטעינת נתוני התקדמות לפי שחקן" }, 500)
  }
}
