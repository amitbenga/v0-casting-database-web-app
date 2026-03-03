import { NextResponse } from "next/server"
import { calculatePercentRecorded, calculateTotals, fetchScriptLinesForProgress, hasLinkedRoleId, isValidProjectId } from "@/lib/progress/server"
import type { ProjectProgressResponse } from "@/lib/progress/types"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ projectId: string }>
}

function jsonNoStore(payload: unknown, status: number = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

export async function GET(_request: Request, { params }: RouteContext) {
  const { projectId } = await params
  const normalizedProjectId = projectId?.trim()

  if (!isValidProjectId(normalizedProjectId)) {
    return jsonNoStore({ error: "מזהה פרויקט לא תקין" }, 400)
  }

  try {
    const { rows, hasRoleIdColumn } = await fetchScriptLinesForProgress(normalizedProjectId)
    const matchedRows = hasRoleIdColumn ? rows.filter((row) => hasLinkedRoleId(row.role_id)) : rows
    const unmatched = hasRoleIdColumn ? rows.filter((row) => !hasLinkedRoleId(row.role_id)).length : 0
    const totals = calculateTotals(matchedRows, unmatched)

    const payload: ProjectProgressResponse = {
      projectId: normalizedProjectId,
      totals,
      percentRecorded: calculatePercentRecorded(totals.recorded, totals.total),
    }

    return jsonNoStore(payload, 200)
  } catch (error) {
    console.error("GET /api/projects/[projectId]/progress failed:", error)
    return jsonNoStore({ error: "שגיאה בטעינת נתוני התקדמות" }, 500)
  }
}
