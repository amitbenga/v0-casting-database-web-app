"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import type { ScriptLine, ScriptLineInput } from "@/lib/types"

interface ActionResult {
  success: boolean
  error?: string
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
      const deleteQuery = supabase
        .from("script_lines")
        .delete()
        .eq("project_id", projectId)

      if (options.scriptId) {
        deleteQuery.eq("script_id", options.scriptId)
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
  updates: Partial<Pick<ScriptLine, "translation" | "rec_status" | "notes">>
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
