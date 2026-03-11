"use server"

import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import type { ScriptLine, ScriptLineInput } from "@/lib/types"

interface ActionResult {
  success: boolean
  error?: string
}

/**
 * Internal helper to backfill role_id on script_lines.
 * Called automatically after saveScriptLines inserts new lines.
 */
async function backfillScriptLinesRoleIdsInternal(
  projectId: string,
  supabase: SupabaseClient
): Promise<number> {
  // 1. Get all project_roles for this project
  const { data: roles, error: rolesError } = await supabase
    .from("project_roles")
    .select("id, role_name")
    .eq("project_id", projectId)

  if (rolesError) throw rolesError

  // Build map: normalized role_name → role_id
  const roleMap = new Map<string, string>()
  for (const role of roles ?? []) {
    roleMap.set(role.role_name.trim().toLowerCase(), role.id)
  }

  // 2. Get all script_lines without role_id
  const { data: lines, error: linesError } = await supabase
    .from("script_lines")
    .select("id, role_name")
    .eq("project_id", projectId)
    .is("role_id", null)

  if (linesError) throw linesError
  if (!lines || lines.length === 0) return 0

  // 3. Group lines by role_id
  const roleLineMap = new Map<string, string[]>()
  for (const line of lines) {
    if (!line.role_name) continue
    const normalized = line.role_name.trim().toLowerCase()
    const roleId = roleMap.get(normalized)
    if (roleId) {
      const existing = roleLineMap.get(roleId) ?? []
      existing.push(line.id)
      roleLineMap.set(roleId, existing)
    }
  }

  // 4. Batch update
  const BATCH = 500
  let updated = 0
  for (const [roleId, lineIds] of roleLineMap) {
    for (let i = 0; i < lineIds.length; i += BATCH) {
      const batch = lineIds.slice(i, i + BATCH)
      const { error } = await supabase
        .from("script_lines")
        .update({ role_id: roleId })
        .in("id", batch)
      if (error) throw error
      updated += batch.length
    }
  }

  return updated
}

/**
 * Bulk-insert script lines for a project.
 * Replaces all existing lines if replaceAll=true (default for initial import).
 */
export async function saveScriptLines(
  projectId: string,
  lines: ScriptLineInput[],
  options: { scriptId?: string; replaceAll?: boolean } = {}
): Promise<ActionResult & { linesCreated?: number }> {
  const supabase = await createClient()

  try {
    if (options.replaceAll) {
      let deleteQuery = supabase
        .from("script_lines")
        .delete()
        .eq("project_id", projectId)

      if (options.scriptId) {
        deleteQuery = deleteQuery.eq("script_id", options.scriptId)
      }

      const { error: deleteError } = await deleteQuery
      if (deleteError) throw deleteError
    }

    if (lines.length === 0) {
      revalidatePath(`/projects/${projectId}`)
      return { success: true, linesCreated: 0 }
    }

    const rows = lines.map((line) => ({
      project_id: projectId,
      script_id: options.scriptId ?? null,
      line_number: line.line_number,
      timecode: line.timecode ?? null,
      role_name: line.role_name,
      actor_id: line.actor_id ?? null,
      source_text: line.source_text ?? null,
      translation: line.translation ?? null,
      rec_status: line.rec_status ?? null,
      notes: line.notes ?? null,
    }))

    // Insert in batches of 500 to avoid payload limits
    const BATCH = 500
    let total = 0
    for (let i = 0; i < rows.length; i += BATCH) {
      const batch = rows.slice(i, i + BATCH)
      const { error } = await supabase.from("script_lines").insert(batch)
      if (error) throw error
      total += batch.length
    }

    // Auto-backfill role_id from project_roles so progress tracking works
    // Fire-and-forget — don't await, errors don't fail the import
    backfillScriptLinesRoleIdsInternal(projectId, supabase).catch((e) =>
      console.error("backfillScriptLinesRoleIds failed:", e)
    )

    revalidatePath(`/projects/${projectId}`)
    return { success: true, linesCreated: total }
  } catch (err) {
    console.error("saveScriptLines error:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Fetch script lines for a project with optional filters.
 * Uses range(0, 9999) to bypass Supabase's default 1000-row cap.
 * Returns lines array + total count.
 */
export async function getScriptLines(
  projectId: string,
  filters: { roleName?: string; recStatus?: string } = {},
  pagination: { from?: number; to?: number } = {}
): Promise<{ lines: ScriptLine[]; total: number }> {
  const supabase = await createClient()

  const from = pagination.from ?? 0
  const to = pagination.to ?? 9999

  let query = supabase
    .from("script_lines")
    .select(
      "id, project_id, script_id, line_number, timecode, role_name, actor_id, actors(full_name), source_text, translation, rec_status, notes, created_at",
      { count: "exact" }
    )
    .eq("project_id", projectId)
    .order("line_number", { ascending: true })
    .range(from, to)

  if (filters.roleName) {
    query = query.eq("role_name", filters.roleName)
  }
  if (filters.recStatus) {
    if (filters.recStatus === "pending") {
      query = query.is("rec_status", null)
    } else {
      query = query.eq("rec_status", filters.recStatus)
    }
  }

  const { data, error, count } = await query
  if (error) {
    console.error("getScriptLines error:", error)
    return { lines: [], total: 0 }
  }

  const lines = (data ?? []).map((row: Record<string, unknown>) => {
    const actorRel = row.actors as { full_name: string } | null
    return {
      ...row,
      actors: undefined,
      actor_name: actorRel?.full_name ?? null,
    } as unknown as ScriptLine
  })

  return { lines, total: count ?? lines.length }
}

/**
 * Update a single script line (inline editing in workspace).
 */
export async function updateScriptLine(
  lineId: string,
  updates: Partial<Pick<ScriptLine, "translation" | "rec_status" | "notes" | "timecode">>
): Promise<ActionResult> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from("script_lines")
      .update(updates)
      .eq("id", lineId)

    if (error) throw error
    return { success: true }
  } catch (err) {
    console.error("updateScriptLine error:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Delete all script lines for a project (used before re-import).
 */
export async function deleteAllScriptLines(projectId: string): Promise<ActionResult> {
  const supabase = await createClient()

  try {
    const { error } = await supabase
      .from("script_lines")
      .delete()
      .eq("project_id", projectId)

    if (error) throw error
    revalidatePath(`/projects/${projectId}`)
    return { success: true }
  } catch (err) {
    console.error("deleteAllScriptLines error:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Delete specific script lines by ID (bulk delete from workspace).
 * Safety check: only deletes lines belonging to the given project.
 */
export async function deleteScriptLinesByIds(
  projectId: string,
  ids: string[]
): Promise<ActionResult & { deletedCount?: number }> {
  const supabase = await createClient()

  try {
    if (ids.length === 0) return { success: true, deletedCount: 0 }

    // Process in batches to avoid URL length limits
    const BATCH = 500
    let deleted = 0
    for (let i = 0; i < ids.length; i += BATCH) {
      const batch = ids.slice(i, i + BATCH)
      const { error, count } = await supabase
        .from("script_lines")
        .delete({ count: "exact" })
        .in("id", batch)
        .eq("project_id", projectId)

      if (error) throw error
      deleted += count ?? batch.length
    }

    revalidatePath(`/projects/${projectId}`)
    return { success: true, deletedCount: deleted }
  } catch (err) {
    console.error("deleteScriptLinesByIds error:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Sync actor assignments from role_castings to script_lines.
 * For each role with a "מלוהק" casting, sets actor_id on matching script_lines.
 * For roles with no casting, clears actor_id.
 * Uses case-insensitive trimmed matching (normalizeRoleKey pattern).
 */
export async function syncActorsToScriptLines(
  projectId: string
): Promise<{ success: boolean; synced: number; cleared: number; error?: string }> {
  const supabase = await createClient()

  try {
    // 1. Get all castings with status "מלוהק" for this project, joined with role name
    const { data: castings, error: castingsError } = await supabase
      .from("role_castings")
      .select("actor_id, project_roles!inner(id, role_name, project_id)")
      .eq("project_roles.project_id", projectId)
      .eq("status", "מלוהק")

    if (castingsError) throw castingsError

    // Build a map: normalized role_name → actor_id
    const roleActorMap = new Map<string, string>()
    for (const casting of castings ?? []) {
      const role = casting.project_roles as unknown as { id: string; role_name: string; project_id: string }
      const normalized = role.role_name.trim().toLowerCase()
      roleActorMap.set(normalized, casting.actor_id)
    }

    // 2. Get all script_lines for this project (just id, role_name, actor_id)
    const { data: allLines, error: linesError } = await supabase
      .from("script_lines")
      .select("id, role_name, actor_id")
      .eq("project_id", projectId)

    if (linesError) throw linesError
    if (!allLines || allLines.length === 0) {
      return { success: true, synced: 0, cleared: 0 }
    }

    // 3. Partition lines into those that need actor_id set and those that need clearing
    const toSync: string[] = []   // line IDs to set actor_id
    const toClear: string[] = []  // line IDs to clear actor_id
    const syncActorMap = new Map<string, string[]>() // actor_id → line IDs

    for (const line of allLines) {
      if (!line.role_name) continue
      const normalizedName = line.role_name.trim().toLowerCase()
      const castActorId = roleActorMap.get(normalizedName)

      if (castActorId) {
        // Role has a casting — set actor_id if different
        if (line.actor_id !== castActorId) {
          toSync.push(line.id)
          const existing = syncActorMap.get(castActorId) ?? []
          existing.push(line.id)
          syncActorMap.set(castActorId, existing)
        }
      } else {
        // Role has no casting — clear actor_id if set
        if (line.actor_id) {
          toClear.push(line.id)
        }
      }
    }

    // 4. Batch update — set actor_id per actor
    const BATCH = 500
    let synced = 0
    for (const [actorId, lineIds] of syncActorMap) {
      for (let i = 0; i < lineIds.length; i += BATCH) {
        const batch = lineIds.slice(i, i + BATCH)
        const { error } = await supabase
          .from("script_lines")
          .update({ actor_id: actorId })
          .in("id", batch)
        if (error) throw error
        synced += batch.length
      }
    }

    // 5. Batch clear actor_id for unassigned roles
    let cleared = 0
    for (let i = 0; i < toClear.length; i += BATCH) {
      const batch = toClear.slice(i, i + BATCH)
      const { error } = await supabase
        .from("script_lines")
        .update({ actor_id: null })
        .in("id", batch)
      if (error) throw error
      cleared += batch.length
    }

    revalidatePath(`/projects/${projectId}`)
    return { success: true, synced, cleared }
  } catch (err) {
    console.error("syncActorsToScriptLines error:", err)
    return { success: false, synced: 0, cleared: 0, error: String(err) }
  }
}

/**
 * Backfill role_id on script_lines from project_roles.
 * Matches by normalized role_name (trimmed, lowercase).
 * Call this after creating roles + importing script lines.
 */
export async function backfillScriptLinesRoleIds(
  projectId: string
): Promise<{ success: boolean; updated: number; error?: string }> {
  const supabase = await createClient()
  try {
    const updated = await backfillScriptLinesRoleIdsInternal(projectId, supabase)
    return { success: true, updated }
  } catch (err) {
    console.error("backfillScriptLinesRoleIds error:", err)
    return { success: false, updated: 0, error: String(err) }
  }
}

/**
 * Get unique role names for a project (for filter dropdown).
 */
export async function getScriptRoles(projectId: string): Promise<string[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("script_lines")
    .select("role_name")
    .eq("project_id", projectId)
    .order("role_name", { ascending: true })

  if (error || !data) return []

  const unique: string[] = Array.from(
    new Set(data.map((r: { role_name: string }) => r.role_name))
  )
  return unique.sort((a: string, b: string) => a.localeCompare(b, "he"))
}
