export type ScriptProcessingStatus = "uploaded" | "processing" | "completed" | "error"
export type ExtractedRoleType = "regular" | "combined" | "group" | "ambiguous"

export interface Actor {
  id: string
  full_name: string
  image_url?: string
  gender: "male" | "female" | "other"
  birth_year?: number
  email?: string
  phone?: string
  voice_sample_url?: string
  created_at: string
}

export interface Project {
  id: string
  name: string
  status: string
  notes?: string
  director?: string
  casting_director?: string
  project_date?: string
  created_at: string
  updated_at: string
}

export interface ProjectRole {
  id: string
  project_id: string
  role_name: string
  role_name_normalized?: string
  parent_role_id?: string
  description?: string
  replicas_needed: number
  source: "manual" | "script"
  created_at: string
}

export interface RoleCasting {
  id: string
  project_id: string
  role_id: string
  actor_id: string
  status: CastingStatus
  notes?: string
  replicas_planned?: number
  replicas_final?: number
  created_at: string
  updated_at: string
  actors?: Actor
  actor?: any // for v0 UI compatibility
}

export interface RoleConflict {
  id: string
  project_id: string
  role_id_a: string
  role_id_b: string
  warning_type: string
  scene_reference?: string
  evidence_json?: any
  created_at: string
}

export interface ProjectRoleWithCasting extends ProjectRole {
  casting?: RoleCasting | null
  children?: ProjectRoleWithCasting[]
  replicas_count: number // for v0 UI compatibility
}

export type CastingStatus = "באודישן" | "בליהוק" | "מלוהק"

export const CASTING_STATUS_LIST: CastingStatus[] = ["באודישן", "בליהוק", "מלוהק"]

export const CASTING_STATUS_COLORS: Record<CastingStatus, string> = {
  "באודישן": "bg-amber-100 text-amber-700 border-amber-200",
  "בליהוק": "bg-blue-100 text-blue-700 border-blue-200",
  "מלוהק": "bg-green-100 text-green-700 border-green-200",
}

export interface CastingActionResult {
  success: boolean
  error?: string
  message_he?: string
  rolesCreated?: number
  conflictsCreated?: number
}

export const SCRIPT_STATUS_LABELS: Record<ScriptProcessingStatus, string> = {
  uploaded: "הועלה",
  processing: "בעיבוד",
  completed: "הושלם",
  error: "שגיאה",
}

export const ROLE_TYPE_LABELS: Record<ExtractedRoleType, string> = {
  regular: "רגיל",
  combined: "משולב",
  group: "קבוצתי",
  ambiguous: "לא ברור",
}
