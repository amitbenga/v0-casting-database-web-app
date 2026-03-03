import type { PostgrestError } from "@supabase/supabase-js"
import { createClient } from "@/lib/supabase/server"
import type { RecordingProgressTotals } from "@/lib/progress/types"

export interface ScriptLineProgressRow {
  project_id: string
  role_id: string | null
  role_name: string | null
  rec_status: string | null
  actor_id: string | null
}

export interface ScriptLinesProgressResult {
  rows: ScriptLineProgressRow[]
  hasRoleIdColumn: boolean
}

interface ScriptLineProgressRowWithoutRoleId {
  project_id: string
  role_name: string | null
  rec_status: string | null
  actor_id: string | null
}

export function isValidProjectId(projectId: string | undefined | null): projectId is string {
  return typeof projectId === "string" && projectId.trim().length > 0
}

export function hasLinkedRoleId(roleId: string | undefined | null): roleId is string {
  return typeof roleId === "string" && roleId.trim().length > 0
}

export function hasAssignedActor(actorId: string | undefined | null): actorId is string {
  return typeof actorId === "string" && actorId.trim().length > 0
}

function normalizeRecStatus(rawStatus: string | null | undefined): "recorded" | "optional" | "notRecorded" | "pending" {
  const value = rawStatus?.trim().toLowerCase()

  if (!value) return "pending"
  if (value === "הוקלט" || value === "recorded") return "recorded"
  if (value === "optional" || value === "אופציונלי") return "optional"
  if (value === "לא הוקלט" || value === "not recorded" || value === "not_recorded" || value === "not-recorded") {
    return "notRecorded"
  }

  return "pending"
}

export function calculateTotals(
  rows: Array<{ rec_status: string | null | undefined }>,
  unmatched: number = 0
): RecordingProgressTotals {
  const totals: RecordingProgressTotals = {
    total: rows.length,
    recorded: 0,
    optional: 0,
    notRecorded: 0,
    pending: 0,
    unmatched,
  }

  for (const row of rows) {
    const normalized = normalizeRecStatus(row.rec_status)
    if (normalized === "recorded") totals.recorded += 1
    if (normalized === "optional") totals.optional += 1
    if (normalized === "notRecorded") totals.notRecorded += 1
    if (normalized === "pending") totals.pending += 1
  }

  return totals
}

export function calculatePercentRecorded(recorded: number, total: number): number {
  if (total <= 0) return 0
  return Math.round((recorded / total) * 1000) / 10
}

function isMissingRoleIdColumnError(error: PostgrestError | null): boolean {
  if (!error) return false

  const text = `${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase()

  if (error.code === "PGRST204" || error.code === "42703") return true

  return text.includes("role_id") && (
    text.includes("column")
      || text.includes("schema cache")
      || text.includes("does not exist")
      || text.includes("could not find")
  )
}

export async function fetchScriptLinesForProgress(projectId: string): Promise<ScriptLinesProgressResult> {
  const supabase = await createClient()

  const withRoleId = await supabase
    .from("script_lines")
    .select("project_id, role_id, role_name, rec_status, actor_id")
    .eq("project_id", projectId)

  if (!withRoleId.error) {
    return {
      rows: (withRoleId.data ?? []) as ScriptLineProgressRow[],
      hasRoleIdColumn: true,
    }
  }

  // Fallback while DB rollout is in progress:
  // if role_id column is not available yet, treat all lines as "matched".
  if (!isMissingRoleIdColumnError(withRoleId.error)) {
    throw withRoleId.error
  }

  const withoutRoleId = await supabase
    .from("script_lines")
    .select("project_id, role_name, rec_status, actor_id")
    .eq("project_id", projectId)

  if (withoutRoleId.error) {
    throw withoutRoleId.error
  }

  const fallbackRows = ((withoutRoleId.data ?? []) as ScriptLineProgressRowWithoutRoleId[]).map((row) => ({
    ...row,
    role_id: null,
  }))

  return {
    rows: fallbackRows,
    hasRoleIdColumn: false,
  }
}
