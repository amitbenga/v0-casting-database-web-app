"use server"

import { createClient } from "@/lib/supabase/server"
import { revalidatePath } from "next/cache"
import { applyParsedRoles } from "@/lib/actions/script-actions"
import { saveScriptLines } from "@/lib/actions/script-line-actions"
import type { ScriptLineInput } from "@/lib/types"

// ─────────────────────────────────────────────
// Types matching migration 007 draft_json schema
// ─────────────────────────────────────────────
export interface DraftRole {
  role_name: string
  role_name_normalized: string
  replicas_count: number
  notes: string | null
}

export interface DraftLine {
  line_number: number
  role_name: string
  source_text: string
  timecode: string | null
}

export interface DraftWarning {
  type: "ambiguous_name" | "low_confidence" | "format_issue" | "duplicate_role"
  message: string
  line_ref: number | null
}

export interface DraftJson {
  roles: DraftRole[]
  lines: DraftLine[]
  warnings: DraftWarning[]
}

export interface ScriptImport {
  id: string
  project_id: string
  source_filename: string
  source_type: string
  status: "pending" | "processing" | "draft_ready" | "applied" | "failed"
  draft_json: DraftJson | null
  model_used: string | null
  tokens_used: number | null
  error_message: string | null
  created_at: string
  apply_summary: Record<string, unknown> | null
}

// ─────────────────────────────────────────────
// 1. Create an import record + store raw text
//    Called before the AI agent runs.
// ─────────────────────────────────────────────
export async function createScriptImport(
  projectId: string,
  sourceFilename: string,
  sourceType: ScriptImport["source_type"],
  rawText: string
): Promise<{ success: boolean; importId?: string; error?: string }> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("script_imports")
    .insert({
      project_id: projectId,
      source_filename: sourceFilename,
      source_type: sourceType,
      raw_text: rawText,
      status: "pending",
    })
    .select("id")
    .single()

  if (error) {
    console.error("[createScriptImport]", error)
    return { success: false, error: error.message }
  }

  return { success: true, importId: data.id }
}

// ─────────────────────────────────────────────
// 2. Get all imports for a project
// ─────────────────────────────────────────────
export async function getScriptImports(projectId: string): Promise<ScriptImport[]> {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("script_imports")
    .select(
      "id, project_id, source_filename, source_type, status, draft_json, model_used, tokens_used, error_message, created_at, apply_summary"
    )
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(20)

  if (error) {
    console.error("[getScriptImports]", error)
    return []
  }

  return (data ?? []) as ScriptImport[]
}

// ─────────────────────────────────────────────
// 3. Apply a draft_ready import to the project
//    Writes to project_roles + script_lines using existing actions.
//    "AI generates draft, human applies" — no direct DB writes here.
// ─────────────────────────────────────────────
export async function applyScriptImport(
  importId: string
): Promise<{ success: boolean; rolesCreated?: number; linesCreated?: number; error?: string }> {
  const supabase = await createClient()

  // Load the import
  const { data: importRow, error: fetchError } = await supabase
    .from("script_imports")
    .select("id, project_id, draft_json, status")
    .eq("id", importId)
    .single()

  if (fetchError || !importRow) return { success: false, error: "Import not found" }
  if (importRow.status !== "draft_ready") {
    return { success: false, error: `Cannot apply import with status: ${importRow.status}` }
  }

  const draft = importRow.draft_json as DraftJson | null
  if (!draft) return { success: false, error: "draft_json is empty" }

  const projectId = importRow.project_id

  try {
    // Apply roles via existing applyParsedRoles (handles upsert + conflict dedup)
    let rolesCreated = 0
    if (draft.roles.length > 0) {
      const rolesForDB = draft.roles.map((r) => ({
        role_name: r.role_name,
        role_name_normalized: r.role_name_normalized,
        replicas_needed: r.replicas_count,
        parent_role_id: null,
      }))

      const roleResult = await applyParsedRoles(projectId, rolesForDB, [])
      if (!roleResult.success) throw new Error(roleResult.error)
      rolesCreated = roleResult.rolesCreated ?? 0
    }

    // Apply lines via existing saveScriptLines
    let linesCreated = 0
    if (draft.lines.length > 0) {
      const linesForDB: ScriptLineInput[] = draft.lines.map((l) => ({
        project_id: projectId,
        line_number: l.line_number,
        role_name: l.role_name,
        source_text: l.source_text,
        timecode: l.timecode ?? undefined,
        translation: undefined,
        rec_status: undefined,
        notes: undefined,
      }))

      const lineResult = await saveScriptLines(projectId, linesForDB, { replace: false })
      if (!lineResult.success) throw new Error(lineResult.error)
      linesCreated = lineResult.count ?? 0
    }

    // Mark import as applied
    await supabase
      .from("script_imports")
      .update({
        status: "applied",
        applied_at: new Date().toISOString(),
        apply_summary: { rolesCreated, linesCreated, warnings: draft.warnings.length },
      })
      .eq("id", importId)

    revalidatePath(`/projects/${projectId}`)

    return { success: true, rolesCreated, linesCreated }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error("[applyScriptImport]", message)

    await supabase
      .from("script_imports")
      .update({ error_message: message })
      .eq("id", importId)

    return { success: false, error: message }
  }
}

// ─────────────────────────────────────────────
// 4. Delete a pending/failed import
// ─────────────────────────────────────────────
export async function deleteScriptImport(importId: string): Promise<{ success: boolean }> {
  const supabase = await createClient()
  const { error } = await supabase
    .from("script_imports")
    .delete()
    .eq("id", importId)
    .in("status", ["pending", "failed", "draft_ready"])

  return { success: !error }
}
