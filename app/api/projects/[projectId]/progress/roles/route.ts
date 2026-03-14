import { NextResponse } from "next/server"
import { requireAuth } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import {
  calculatePercentRecorded,
  calculateTotals,
  fetchScriptLinesForProgress,
  hasLinkedRoleId,
  isValidProjectId,
  type ScriptLineProgressRow,
} from "@/lib/progress/server"
import type { RoleProgressResponseItem, RolesProgressResponse } from "@/lib/progress/types"

export const dynamic = "force-dynamic"

interface RouteContext {
  params: Promise<{ projectId: string }>
}

interface ProjectRoleLookupRow {
  id: string
  role_name: string
}

function jsonNoStore(payload: unknown, status: number = 200): NextResponse {
  return NextResponse.json(payload, {
    status,
    headers: {
      "Cache-Control": "no-store",
    },
  })
}

function groupByRoleId(rows: ScriptLineProgressRow[]): Map<string, ScriptLineProgressRow[]> {
  const grouped = new Map<string, ScriptLineProgressRow[]>()

  for (const row of rows) {
    if (!hasLinkedRoleId(row.role_id)) continue
    const existing = grouped.get(row.role_id) ?? []
    existing.push(row)
    grouped.set(row.role_id, existing)
  }

  return grouped
}

function groupByRoleName(rows: ScriptLineProgressRow[]): Map<string, ScriptLineProgressRow[]> {
  const grouped = new Map<string, ScriptLineProgressRow[]>()

  for (const row of rows) {
    const key = row.role_name?.trim() || "ללא תפקיד"
    const existing = grouped.get(key) ?? []
    existing.push(row)
    grouped.set(key, existing)
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

    const { rows, hasRoleIdColumn } = await fetchScriptLinesForProgress(normalizedProjectId)

    if (!hasRoleIdColumn) {
      const groupedByName = groupByRoleName(rows)
      const payload: RolesProgressResponse = Array.from(groupedByName.entries())
        .map(([roleName, roleRows]) => {
          const totals = calculateTotals(roleRows)
          const item: RoleProgressResponseItem = {
            roleId: null,
            roleName,
            totals,
            percentRecorded: calculatePercentRecorded(totals.recorded, totals.total),
          }
          return item
        })
        .sort((a, b) => a.roleName.localeCompare(b.roleName, "he"))

      return jsonNoStore(payload, 200)
    }

    const groupedByRoleId = groupByRoleId(rows)
    const supabase = await createClient()
    const { data: roleLookupRows, error: roleLookupError } = await supabase
      .from("project_roles")
      .select("id, role_name")
      .eq("project_id", normalizedProjectId)

    if (roleLookupError) throw roleLookupError

    const roleNameById = new Map<string, string>(
      ((roleLookupRows ?? []) as ProjectRoleLookupRow[]).map((row) => [row.id, row.role_name])
    )

    const payload: RolesProgressResponse = Array.from(groupedByRoleId.entries())
      .map(([roleId, roleRows]) => {
        const fallbackRoleName = roleRows.find((row) => Boolean(row.role_name?.trim()))?.role_name?.trim() || "ללא תפקיד"
        const totals = calculateTotals(roleRows)
        const item: RoleProgressResponseItem = {
          roleId,
          roleName: roleNameById.get(roleId) ?? fallbackRoleName,
          totals,
          percentRecorded: calculatePercentRecorded(totals.recorded, totals.total),
        }
        return item
      })
      .sort((a, b) => a.roleName.localeCompare(b.roleName, "he"))

    return jsonNoStore(payload, 200)
  } catch (error) {
    console.error("GET /api/projects/[projectId]/progress/roles failed:", error)
    return jsonNoStore({ error: "שגיאה בטעינת נתוני התקדמות לפי תפקיד" }, 500)
  }
}
