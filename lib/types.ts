export type ScriptProcessingStatus = "uploaded" | "processing" | "completed" | "error"
export type ExtractedRoleType = "regular" | "combined" | "group" | "ambiguous"
export type VatStatus = "ptor" | "murshe" | "artist_salary"
export type Gender = "male" | "female" | "other"

export type SingingStyleLevel = "basic" | "medium" | "high"
export type SingingStyle = "opera" | "pop" | "rock" | "jazz" | "classical" | "musical" | "folk" | "other"

export interface SingingStyleWithLevel {
  style: SingingStyle
  level: SingingStyleLevel
}

export interface SingingStyleOther {
  name: string
  level: SingingStyleLevel
}

export interface Skill {
  id: string
  key: string
  label: string
}

export interface Language {
  id: string
  key: string
  label: string
}

export interface Actor {
  id: string
  full_name: string
  image_url?: string
  gender: Gender
  birth_year?: number
  email?: string
  phone?: string
  voice_sample_url?: string
  singing_sample_url?: string
  youtube_link?: string
  singing_styles?: string[]
  singing_level?: string
  created_at: string
  vat_status: VatStatus
  is_draft?: boolean
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
  role_a_name?: string
  role_b_name?: string
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

export const VAT_STATUS_LABELS: Record<VatStatus, string> = {
  ptor: "פטור",
  murshe: "מורשה",
  artist_salary: "שכר אמנים",
}

export const SINGING_STYLE_LEVEL_LABELS: Record<SingingStyleLevel, string> = {
  basic: "בסיסי",
  medium: "בינוני",
  high: "גבוה",
}

export const SINGING_STYLES_LIST: { key: SingingStyle; label: string }[] = [
  { key: "opera", label: "אופרה" },
  { key: "pop", label: "פופ" },
  { key: "rock", label: "רוק" },
  { key: "jazz", label: "ג׳אז" },
  { key: "classical", label: "קלאסי" },
  { key: "musical", label: "מחזמר" },
  { key: "folk", label: "פולק" },
  { key: "other", label: "אחר" },
]

export const SKILLS_LIST: Skill[] = [
  { id: "1", key: "acting", label: "משחק" },
  { id: "2", key: "singing", label: "שירה" },
  { id: "3", key: "voice_acting", label: "קריינות" },
  { id: "4", key: "carpentry", label: "נגרות" },
  { id: "5", key: "russian_accent", label: "מבטא רוסי" },
  { id: "6", key: "french_accent", label: "מבטא צרפתי" },
  { id: "7", key: "spanish_accent", label: "מבטא ספרדי" },
  { id: "8", key: "german_accent", label: "מבטא גרמני" },
  { id: "9", key: "english_accent", label: "מבטא אנגלי" },
  { id: "10", key: "italian_accent", label: "מבטא איטלקי" },
  { id: "11", key: "any_accent", label: "כל מבטא אפשרי" },
]

export const LANGUAGES_LIST: Language[] = [
  { id: "1", key: "hebrew", label: "עברית" },
  { id: "2", key: "english", label: "אנגלית" },
  { id: "3", key: "russian", label: "רוסית" },
  { id: "4", key: "arabic", label: "ערבית" },
  { id: "5", key: "french", label: "צרפתית" },
  { id: "6", key: "spanish", label: "ספרדית" },
  { id: "7", key: "german", label: "גרמנית" },
  { id: "8", key: "italian", label: "איטלקית" },
  { id: "9", key: "amharic", label: "אמהרית" },
  { id: "10", key: "yiddish", label: "יידיש" },
  { id: "11", key: "portuguese", label: "פורטוגזית" },
  { id: "12", key: "romanian", label: "רומנית" },
]

export const DUBBING_EXPERIENCE_RANGES = [
  { key: "0-1", label: "0-1 שנים", min: 0, max: 1 },
  { key: "2-4", label: "2-4 שנים", min: 2, max: 4 },
  { key: "5+", label: "5+ שנים", min: 5, max: 999 },
]
