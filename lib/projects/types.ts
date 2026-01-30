// ===================================
// Project Types - מודל יעד חדש
// ===================================

// סטטוס פרויקט
export type ProjectStatus = "not_started" | "casting" | "casted" | "recording" | "completed"

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "טרם התחיל",
  casting: "בליהוק",
  casted: "לוהק",
  recording: "בהקלטה",
  completed: "הושלם",
}

// סטטוס שיבוץ שחקן לתפקיד
export type CastingStatus = "באודישן" | "בליהוק" | "מלוהק"

export const CASTING_STATUS_OPTIONS: CastingStatus[] = ["באודישן", "בליהוק", "מלוהק"]

// סטטוס עיבוד תסריט
export type ScriptProcessingStatus = "uploaded" | "processing" | "completed" | "error"

// ===================================
// Entities
// ===================================

export interface Project {
  id: string
  name: string
  status: ProjectStatus
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
  parent_role_id: string | null
  replicas_count: number
  replicas_needed?: number
  created_at: string
}

export interface ActorBasic {
  id: string
  name: string
  image_url?: string
  voice_sample_url?: string
}

export interface RoleCasting {
  id: string
  role_id: string
  actor: ActorBasic
  status: CastingStatus
  replicas_planned?: number
  replicas_final?: number
  notes?: string
  created_at: string
}

export interface ProjectScript {
  id: string
  project_id: string
  file_name: string
  file_url: string
  file_type: string
  file_size_bytes: number
  processing_status: ScriptProcessingStatus
  processing_error?: string
  processed_at?: string
  created_at: string
  updated_at: string
}

export interface RoleConflict {
  id: string
  project_id: string
  role_1_id: string
  role_2_id: string
  scene_reference?: string
  notes?: string
}

// ===================================
// API Response Types
// ===================================

export interface ProjectRoleWithCasting extends ProjectRole {
  casting: RoleCasting | null
  children?: ProjectRoleWithCasting[]
}

export interface GetProjectRolesResponse {
  roles: ProjectRoleWithCasting[]
}

export interface AssignActorResponse {
  success: true
  casting: RoleCasting
}

export interface CastingConflictError {
  code: "CASTING_CONFLICT"
  message_he: string
}

export interface ApplyParsedScriptResponse {
  success: true
  roles_created: number
  conflicts_created: number
}

// ===================================
// UI State Types
// ===================================

export interface RolesFilterState {
  search: string
  showOnlyUnassigned: boolean
  sortByReplicas: "desc" | "asc" | null
}

// Type guard for conflict error
export function isCastingConflictError(error: unknown): error is CastingConflictError {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as CastingConflictError).code === "CASTING_CONFLICT"
  )
}
