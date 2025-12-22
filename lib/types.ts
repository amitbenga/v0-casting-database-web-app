export type VatStatus = "ptor" | "murshe" | "artist_salary"
export type ProjectStatus = "not_started" | "casting" | "casted" | "recording" | "completed"
export type Gender = "male" | "female"

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
}

export interface CastingProject {
  id: string
  name: string
  status: ProjectStatus
  notes: string
  created_at: string
  updated_at: string
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
export const SKILLS_LIST: Skill[] = [
  { id: "1", key: "acting", label: "משחק" },
  { id: "2", key: "singing", label: "שירה" },
  { id: "3", key: "voice_acting", label: "קריינות" },
  { id: "4", key: "carpentry", label: "נגרות" },
  { id: "5", key: "russian_accent", label: "מבטא רוסי" },
  { id: "6", key: "any_accent", label: "כל מבטא אפשרי" },
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

export function getDefaultAvatar(gender: Gender): string {
  return gender === "male" ? "/male-silhouette-professional.jpg" : "/female-silhouette-professional.jpg"
}
