"use server"

import { createClient } from "@/lib/supabase/server"
import type { SupabaseClient } from "@supabase/supabase-js"
import { revalidatePath } from "next/cache"
import type { ScriptLine, ScriptLineInput } from "@/lib/types"
import { requireAuth } from "@/lib/auth-guard"

interface ActionResult {
  success: boolean
  error?: string
}

const SORT_INDEX_STEP = 1024

type ManualInsertPosition = "above" | "below"

type ScriptLineOrderRow = {
  id: string
  project_id: string
  role_name: string
  sort_index: number | null
  line_number: number | null
  created_at: string
}

function toNumberOrNull(value: unknown): number | null {
  if (value == null) return null
  const num = Number(value)
  return Number.isFinite(num) ? num : null
}

function normalizeOrderRow(row: Record<string, unknown>): ScriptLineOrderRow {
  return {
    id: String(row.id),
    project_id: String(row.project_id),
    role_name: String(row.role_name ?? ""),
    sort_index: toNumberOrNull(row.sort_index),
    line_number: toNumberOrNull(row.line_number),
    created_at: String(row.created_at ?? ""),
  }
}

async function listProjectLineOrder(
  projectId: string,
  supabase: SupabaseClient
): Promise<ScriptLineOrderRow[]> {
  const { data, error } = await supabase
    .from("script_lines")
    .select("id, project_id, role_name, sort_index, line_number, created_at")
    .eq("project_id", projectId)
    .order("sort_index", { ascending: true, nullsFirst: false })
    .order("line_number", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: true })
    .order("id", { ascending: true })

  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => normalizeOrderRow(row))
}

async function getCurrentMaxSortIndex(
  projectId: string,
  supabase: SupabaseClient
): Promise<number> {
  const orderedRows = await listProjectLineOrder(projectId, supabase)
  return orderedRows.reduce((max, row) => Math.max(max, row.sort_index ?? 0), 0)
}

async function getNextManualLineNumber(
  projectId: string,
  supabase: SupabaseClient
): Promise<number> {
  const { data, error } = await supabase
    .from("script_lines")
    .select("line_number")
    .eq("project_id", projectId)
    .order("line_number", { ascending: false, nullsFirst: false })
    .limit(1)

  if (error) throw error
  return (toNumberOrNull(data?.[0]?.line_number) ?? 0) + 1
}

async function rebalanceProjectLineSortIndexes(
  projectId: string,
  supabase: SupabaseClient,
  orderedRows?: ScriptLineOrderRow[]
): Promise<ScriptLineOrderRow[]> {
  const rows = orderedRows ?? await listProjectLineOrder(projectId, supabase)
  if (rows.length === 0) return []

  const updates = rows
    .map((row, index) => ({
      id: row.id,
      project_id: row.project_id,
      role_name: row.role_name,
      sort_index: (index + 1) * SORT_INDEX_STEP,
    }))
    .filter((update, index) => rows[index].sort_index !== update.sort_index)

  if (updates.length > 0) {
    const BATCH = 500
    for (let i = 0; i < updates.length; i += BATCH) {
      const batch = updates.slice(i, i + BATCH)
      const { error } = await supabase
        .from("script_lines")
        .upsert(batch, { onConflict: "id", ignoreDuplicates: false })
      if (error) throw error
    }
  }

  return rows.map((row, index) => ({
    ...row,
    sort_index: (index + 1) * SORT_INDEX_STEP,
  }))
}

function computeRelativeSortIndex(
  orderedRows: ScriptLineOrderRow[],
  referenceLineId: string,
  position: ManualInsertPosition
): number | null {
  const refIndex = orderedRows.findIndex((row) => row.id === referenceLineId)
  if (refIndex === -1) return null

  const prevSortIndex = position === "above"
    ? orderedRows[refIndex - 1]?.sort_index ?? null
    : orderedRows[refIndex].sort_index ?? null
  const nextSortIndex = position === "above"
    ? orderedRows[refIndex].sort_index ?? null
    : orderedRows[refIndex + 1]?.sort_index ?? null

  if (prevSortIndex == null && nextSortIndex == null) {
    return SORT_INDEX_STEP
  }
  if (prevSortIndex == null && nextSortIndex != null) {
    return nextSortIndex - SORT_INDEX_STEP
  }
  if (prevSortIndex != null && nextSortIndex == null) {
    return prevSortIndex + SORT_INDEX_STEP
  }
  if (prevSortIndex == null || nextSortIndex == null) {
    return null
  }

  const gap = nextSortIndex - prevSortIndex
  if (gap <= 1) {
    return null
  }

  return prevSortIndex + Math.floor(gap / 2)
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
    await requireAuth()
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

    const baseSortIndex = await getCurrentMaxSortIndex(projectId, supabase)
    const rows = lines.map((line, index) => ({
      project_id: projectId,
      script_id: options.scriptId ?? null,
      sort_index: baseSortIndex + ((index + 1) * SORT_INDEX_STEP),
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

  await requireAuth()
  const from = pagination.from ?? 0
  const to = pagination.to ?? 9999

  let query = supabase
    .from("script_lines")
    .select(
      "id, project_id, script_id, sort_index, line_number, timecode, role_name, actor_id, actors(full_name), source_text, translation, rec_status, notes, created_at",
      { count: "exact" }
    )
    .eq("project_id", projectId)
    .order("sort_index", { ascending: true, nullsFirst: false })
    .order("line_number", { ascending: true, nullsFirst: false })
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
      sort_index: toNumberOrNull(row.sort_index) ?? undefined,
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
  updates: Partial<Pick<ScriptLine, "translation" | "rec_status" | "notes" | "timecode" | "source_text">>
): Promise<ActionResult> {
  const supabase = await createClient()

  try {
    await requireAuth()
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
 * Add a single new script line manually.
 */
export async function addScriptLine(
  projectId: string,
  line: ScriptLineInput
): Promise<ActionResult & { line?: ScriptLine }> {
  const supabase = await createClient()

  try {
    await requireAuth()
    const nextSortIndex = await getCurrentMaxSortIndex(projectId, supabase) + SORT_INDEX_STEP
    const nextLineNumber = line.line_number > 0
      ? line.line_number
      : await getNextManualLineNumber(projectId, supabase)

    const { data, error } = await supabase
      .from("script_lines")
      .insert({
        project_id: projectId,
        sort_index: nextSortIndex,
        line_number: nextLineNumber,
        timecode: line.timecode ?? null,
        role_name: line.role_name,
        actor_id: line.actor_id ?? null,
        source_text: line.source_text ?? null,
        translation: line.translation ?? null,
        rec_status: line.rec_status ?? null,
        notes: line.notes ?? null,
      })
      .select("id, project_id, script_id, sort_index, line_number, timecode, role_name, actor_id, source_text, translation, rec_status, notes, created_at")
      .single()

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)
    return {
      success: true,
      line: {
        ...(data as unknown as ScriptLine),
        sort_index: toNumberOrNull((data as Record<string, unknown>).sort_index) ?? undefined,
      },
    }
  } catch (err) {
    console.error("addScriptLine error:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Insert a blank script line relative to an existing row.
 * Prefills role_name and actor_id from the reference row for faster editing.
 */
export async function insertScriptLineRelative(
  projectId: string,
  referenceLineId: string,
  position: ManualInsertPosition
): Promise<ActionResult & { line?: ScriptLine }> {
  const supabase = await createClient()

  try {
    await requireAuth()
    const { data: referenceRow, error: referenceError } = await supabase
      .from("script_lines")
      .select("id, project_id, script_id, role_name, actor_id")
      .eq("project_id", projectId)
      .eq("id", referenceLineId)
      .single()

    if (referenceError || !referenceRow) {
      return { success: false, error: "Reference line not found" }
    }

    let orderedRows = await listProjectLineOrder(projectId, supabase)
    let sortIndex = computeRelativeSortIndex(orderedRows, referenceLineId, position)

    if (sortIndex == null) {
      orderedRows = await rebalanceProjectLineSortIndexes(projectId, supabase, orderedRows)
      sortIndex = computeRelativeSortIndex(orderedRows, referenceLineId, position)
    }

    if (sortIndex == null) {
      throw new Error("Could not calculate insertion position")
    }

    const nextLineNumber = await getNextManualLineNumber(projectId, supabase)
    const { data, error } = await supabase
      .from("script_lines")
      .insert({
        project_id: projectId,
        script_id: referenceRow.script_id ?? null,
        sort_index: sortIndex,
        line_number: nextLineNumber,
        timecode: null,
        role_name: referenceRow.role_name,
        actor_id: referenceRow.actor_id ?? null,
        source_text: null,
        translation: null,
        rec_status: null,
        notes: null,
      })
      .select("id, project_id, script_id, sort_index, line_number, timecode, role_name, actor_id, source_text, translation, rec_status, notes, created_at")
      .single()

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)
    return {
      success: true,
      line: {
        ...(data as unknown as ScriptLine),
        sort_index: toNumberOrNull((data as Record<string, unknown>).sort_index) ?? undefined,
      },
    }
  } catch (err) {
    console.error("insertScriptLineRelative error:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Duplicate an existing script line and place the copy directly below it.
 */
export async function duplicateScriptLine(
  projectId: string,
  sourceLineId: string
): Promise<ActionResult & { line?: ScriptLine }> {
  const supabase = await createClient()

  try {
    await requireAuth()
    const { data: sourceLine, error: sourceError } = await supabase
      .from("script_lines")
      .select("id, project_id, script_id, role_name, actor_id, timecode, source_text, translation, rec_status, notes")
      .eq("project_id", projectId)
      .eq("id", sourceLineId)
      .single()

    if (sourceError || !sourceLine) {
      return { success: false, error: "Source line not found" }
    }

    let orderedRows = await listProjectLineOrder(projectId, supabase)
    let sortIndex = computeRelativeSortIndex(orderedRows, sourceLineId, "below")

    if (sortIndex == null) {
      orderedRows = await rebalanceProjectLineSortIndexes(projectId, supabase, orderedRows)
      sortIndex = computeRelativeSortIndex(orderedRows, sourceLineId, "below")
    }

    if (sortIndex == null) {
      throw new Error("Could not calculate duplication position")
    }

    const nextLineNumber = await getNextManualLineNumber(projectId, supabase)
    const { data, error } = await supabase
      .from("script_lines")
      .insert({
        project_id: projectId,
        script_id: sourceLine.script_id ?? null,
        sort_index: sortIndex,
        line_number: nextLineNumber,
        timecode: sourceLine.timecode ?? null,
        role_name: sourceLine.role_name,
        actor_id: sourceLine.actor_id ?? null,
        source_text: sourceLine.source_text ?? null,
        translation: sourceLine.translation ?? null,
        rec_status: sourceLine.rec_status ?? null,
        notes: sourceLine.notes ?? null,
      })
      .select("id, project_id, script_id, sort_index, line_number, timecode, role_name, actor_id, source_text, translation, rec_status, notes, created_at")
      .single()

    if (error) throw error

    revalidatePath(`/projects/${projectId}`)
    return {
      success: true,
      line: {
        ...(data as unknown as ScriptLine),
        sort_index: toNumberOrNull((data as Record<string, unknown>).sort_index) ?? undefined,
      },
    }
  } catch (err) {
    console.error("duplicateScriptLine error:", err)
    return { success: false, error: String(err) }
  }
}

/**
 * Delete all script lines for a project (used before re-import).
 */
export async function deleteAllScriptLines(projectId: string): Promise<ActionResult> {
  const supabase = await createClient()

  try {
    await requireAuth()
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
    await requireAuth()
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
    await requireAuth()
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
    const toClear: string[] = []
    const syncActorMap = new Map<string, string[]>()

    for (const line of allLines) {
      if (!line.role_name) continue
      const normalizedName = line.role_name.trim().toLowerCase()
      const castActorId = roleActorMap.get(normalizedName)

      if (castActorId) {
        if (line.actor_id !== castActorId) {
          const existing = syncActorMap.get(castActorId) ?? []
          existing.push(line.id)
          syncActorMap.set(castActorId, existing)
        }
      } else if (line.actor_id) {
        toClear.push(line.id)
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
    await requireAuth()
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
  await requireAuth()
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

/**
 * Get replica (line) counts per role from DB — not affected by pagination.
 * Returns a record of { role_name: count }.
 */
export async function getScriptLineCountsByRole(
  projectId: string
): Promise<Record<string, number>> {
  await requireAuth()
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("script_lines")
    .select("role_name")
    .eq("project_id", projectId)

  if (error || !data) return {}

  const counts: Record<string, number> = {}
  for (const row of data) {
    counts[row.role_name] = (counts[row.role_name] ?? 0) + 1
  }
  return counts
}
