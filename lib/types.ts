export type VatStatus = "ptor" | "murshe" | "artist_salary"
export type ProjectStatus = "not_started" | "casting" | "casted" | "recording" | "completed"
export type Gender = "male" | "female"
export type SingingStyleLevel = "basic" | "medium" | "high"
export type SingingStyle = "opera" | "pop" | "rock" | "jazz" | "classical" | "musical" | "folk" | "other"

// מבנה חדש - כל סגנון עם רמה
export interface SingingStyleWithLevel {
  style: SingingStyle
  level: SingingStyleLevel
}

// סגנונות מותאמים אישית (אחר)
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
  created_at: string
  updated_at: string
  full_name: string
  gender: Gender
  birth_year: number
  phone: string
  email: string
  is_singer: boolean
  is_course_grad: boolean
  vat_status: VatStatus
  image_url: string
  voice_sample_url?: string
  other_lang_text?: string
  notes: string
  city?: string
  skills: Skill[]
  languages: Language[]
  // שדות חדשים - דיבוב ושירה
  dubbing_experience_years?: number
  singing_styles?: SingingStyleWithLevel[]
  singing_styles_other?: SingingStyleOther[]
}

export interface CastingProject {
  id: string
  name: string
  status: ProjectStatus
  notes: string
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
  created_at: string
}

export interface ProjectActor {
  id: string
  project_id: string
  actor_id: string
  role_name: string
  replicas_planned: number
  replicas_final: number
  notes: string
  actor?: Actor
}

export interface RoleCasting {
  id: string
  project_id: string
  role_id: string
  actor_id: string
  status: string
  notes?: string
  replicas_planned: number
  replicas_final: number
  created_at: string
  updated_at: string
  actors?: Actor
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
  role_castings?: RoleCasting
}

export interface Folder {
  id: string
  name: string
  created_at: string
  actor_count?: number
}

export interface Favorite {
  id: string
  actor_id: string
  user_id: "leni" | "father"
}

// Predefined lists as per specification
// הוסר: משחק, קומדיה, שירה - שירה מנוהלת דרך שדות נפרדים
export const SKILLS_LIST: Skill[] = [
  { id: "3", key: "voice_acting", label: "קריינות" },
  { id: "5", key: "russian_accent", label: "מבטא רוסי" },
  { id: "6", key: "any_accent", label: "כל מבטא אפשרי" },
]

// רמות סגנון שירה
export const SINGING_STYLE_LEVEL_LABELS: Record<SingingStyleLevel, string> = {
  basic: "בסיסי",
  medium: "בינוני",
  high: "גבוה",
}

// סגנונות שירה
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

// טווחי ניסיון בדיבוב לסינון
export const DUBBING_EXPERIENCE_RANGES = [
  { key: "0-1", label: "0-1 שנים", min: 0, max: 1 },
  { key: "2-4", label: "2-4 שנים", min: 2, max: 4 },
  { key: "5+", label: "5+ שנים", min: 5, max: 999 },
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

export const VAT_STATUS_LABELS: Record<VatStatus, string> = {
  ptor: "פטור",
  murshe: "מורשה",
  artist_salary: "שכר אמנים",
}

export const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
  not_started: "טרם התחיל",
  casting: "בקאסטינג",
  casted: "נבחרו שחקנים",
  recording: "בהקלטה",
  completed: "הושלם",
}

export const GENDER_LABELS: Record<Gender, string> = {
  male: "זכר",
  female: "נקבה",
}

export interface FilterState {
  gender: string[]
  ageMin: number
  ageMax: number
  isSinger: boolean | null
  isCourseGrad: boolean | null
  skills: string[]
  languages: string[]
  vatStatus: string[]
  sortBy: string
  dubbingExperience: string[]
  singingStyles: SingingStyle[]
}

export function getDefaultAvatar(gender: Gender): string {
  return gender === "male" ? "/male-silhouette-professional.jpg" : "/female-silhouette-professional.jpg"
}

// Script Processing Types
export type ScriptProcessingStatus = "uploaded" | "processing" | "completed" | "error"
export type ExtractedRoleType = "regular" | "combined" | "group" | "ambiguous"
export type CastingWarningType = "same_scene" | "other"

export interface ProjectScript {
  id: string
  project_id: string
  file_name: string
  file_url?: string
  file_type?: string
  file_size_bytes?: number
  processing_status: ScriptProcessingStatus
  processing_error?: string
  processed_at?: string
  created_at: string
  updated_at: string
}

export interface ScriptExtractedRole {
  id: string
  project_id: string
  script_id?: string
  role_name: string
  role_type: ExtractedRoleType
  replicas_count: number
  first_appearance_script?: string
  notes?: string
  created_at: string
}

export interface ScriptCastingWarning {
  id: string
  project_id: string
  role_1_name: string
  role_2_name: string
  scene_reference?: string
  warning_type: CastingWarningType
  notes?: string
  created_at: string
}

export const SCRIPT_STATUS_LABELS: Record<ScriptProcessingStatus, string> = {
  uploaded: "הועלה",
  processing: "בעיבוד",
  completed: "עובד בהצלחה",
  error: "שגיאה",
}

export const ROLE_TYPE_LABELS: Record<ExtractedRoleType, string> = {
  regular: "רגיל",
  combined: "משולב",
  group: "קבוצתי",
  ambiguous: "לא ברור",
}
