import { createClient } from "@/lib/supabase/server"

interface ProjectRoleRow {
  id: string
  role_name: string
  role_name_normalized: string | null
}

interface ScriptLineRoleRow {
  id: string
  role_name: string | null
  role_id: string | null
  role_match_status: "matched" | "suggested" | "unmatched" | null
}

function normalizeRoleKey(value: string | null | undefined): string {
  return (value ?? "").trim().toLowerCase()
}

async function updateScriptLinesInBatches(
  projectId: string,
  lineIds: string[],
  payload: { role_id: string | null; role_match_status: "matched" | "unmatched" }
) {
  if (lineIds.length === 0) return

  const supabase = await createClient()
  const BATCH_SIZE = 500

  for (let index = 0; index < lineIds.length; index += BATCH_SIZE) {
    const batch = lineIds.slice(index, index + BATCH_SIZE)
    const { error } = await supabase
      .from("script_lines")
      .update(payload)
      .eq("project_id", projectId)
      .in("id", batch)

    if (error) throw error
  }
}

/**
 * Backfills script_lines.role_id from project_roles for one project.
 * Matching key is normalized role name (trim + lowercase).
 */
export async function backfillScriptLinesRoleIds(projectId: string): Promise<{ matched: number; unmatched: number }> {
  const supabase = await createClient()

  const { data: roles, error: rolesError } = await supabase
    .from("project_roles")
    .select("id, role_name, role_name_normalized")
    .eq("project_id", projectId)

  if (rolesError) throw rolesError

  const roleIdByNormalizedName = new Map<string, string>()
  for (const role of (roles ?? []) as ProjectRoleRow[]) {
    const normalized = normalizeRoleKey(role.role_name_normalized || role.role_name)
    if (!normalized || roleIdByNormalizedName.has(normalized)) continue
    roleIdByNormalizedName.set(normalized, role.id)
  }

  const { data: scriptLines, error: scriptLinesError } = await supabase
    .from("script_lines")
    .select("id, role_name, role_id, role_match_status")
    .eq("project_id", projectId)

  if (scriptLinesError) throw scriptLinesError

  const matchedLineIdsByRoleId = new Map<string, string[]>()
  const unmatchedLineIds: string[] = []

  for (const line of (scriptLines ?? []) as ScriptLineRoleRow[]) {
    const normalizedLineRoleName = normalizeRoleKey(line.role_name)
    const matchedRoleId = normalizedLineRoleName ? roleIdByNormalizedName.get(normalizedLineRoleName) : undefined

    if (matchedRoleId) {
      const needsUpdate = line.role_id !== matchedRoleId || line.role_match_status !== "matched"
      if (!needsUpdate) continue
      const roleIds = matchedLineIdsByRoleId.get(matchedRoleId) ?? []
      roleIds.push(line.id)
      matchedLineIdsByRoleId.set(matchedRoleId, roleIds)
      continue
    }

    const needsUnmatchedUpdate = line.role_id !== null || line.role_match_status !== "unmatched"
    if (needsUnmatchedUpdate) {
      unmatchedLineIds.push(line.id)
    }
  }

  let matchedUpdates = 0
  for (const [roleId, lineIds] of matchedLineIdsByRoleId.entries()) {
    await updateScriptLinesInBatches(projectId, lineIds, {
      role_id: roleId,
      role_match_status: "matched",
    })
    matchedUpdates += lineIds.length
  }

  await updateScriptLinesInBatches(projectId, unmatchedLineIds, {
    role_id: null,
    role_match_status: "unmatched",
  })

  return {
    matched: matchedUpdates,
    unmatched: unmatchedLineIds.length,
  }
}
