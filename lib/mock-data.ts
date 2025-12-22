import { type Actor, type CastingProject, type Folder, SKILLS_LIST, LANGUAGES_LIST } from "./types"

export const mockActors: Actor[] = [
  {
    id: "1",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "מיכה אוזין סליאן",
    gender: "male",
    birth_year: 1963,
    phone: "052-827-2740",
    email: "",
    is_singer: true,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "פתח תקווה",
    skills: [SKILLS_LIST[1], SKILLS_LIST[0]], // שירה, משחק
    languages: [LANGUAGES_LIST[1]], // אנגלית
  },
  {
    id: "2",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "אלון נוימן",
    gender: "male",
    birth_year: 1967,
    phone: "054-442-8999",
    email: "",
    is_singer: true,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "תל אביב",
    skills: [SKILLS_LIST[1]], // שירה
    languages: [LANGUAGES_LIST[1], LANGUAGES_LIST[4]], // אנגלית, צרפתית
  },
  {
    id: "3",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "שאול עזר",
    gender: "male",
    birth_year: 1970,
    phone: "052-290-3078",
    email: "",
    is_singer: false,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "פתח תקווה",
    skills: [SKILLS_LIST[0], SKILLS_LIST[5]], // משחק, כל מבטא אפשרי
    languages: [LANGUAGES_LIST[1], LANGUAGES_LIST[3]], // אנגלית, ערבית
    other_lang_text: "אנגלית – בינוני, ערבית – בינוני",
  },
  {
    id: "4",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "רובי מוסקוביץ",
    gender: "male",
    birth_year: 1971,
    phone: "050-234-4006",
    email: "",
    is_singer: true,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "ניר צבי",
    skills: [SKILLS_LIST[1], SKILLS_LIST[0], SKILLS_LIST[3]], // שירה, משחק, נגרות
    languages: [LANGUAGES_LIST[1], LANGUAGES_LIST[3]], // אנגלית, ערבית (שפת אם)
    other_lang_text: "ערבית (שפת אם)",
  },
  {
    id: "5",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "אמנון וולף",
    gender: "male",
    birth_year: 1972,
    phone: "054-444-9194",
    email: "",
    is_singer: false,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "פרדס חנה",
    skills: [SKILLS_LIST[0], SKILLS_LIST[4]], // משחק, מבטא רוסי
    languages: [LANGUAGES_LIST[1]], // אנגלית
  },
  {
    id: "6",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "נתן דטנר",
    gender: "male",
    birth_year: 1956,
    phone: "052-355-5585",
    email: "",
    is_singer: false,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "תל אביב",
    skills: [SKILLS_LIST[0], SKILLS_LIST[2]], // משחק, קריינות
    languages: [LANGUAGES_LIST[1]], // אנגלית
  },
  {
    id: "7",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "שלומי נטל",
    gender: "male",
    birth_year: 1975,
    phone: "054-771-2442",
    email: "",
    is_singer: true,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "ראשון לציון",
    skills: [SKILLS_LIST[0], SKILLS_LIST[1]], // משחק, שירה
    languages: [LANGUAGES_LIST[1]], // אנגלית
  },
  {
    id: "8",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "שרון כהן",
    gender: "female",
    birth_year: 1980,
    phone: "054-123-4567",
    email: "",
    is_singer: false,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "רמת גן",
    skills: [SKILLS_LIST[0], SKILLS_LIST[2]], // משחק, קריינות
    languages: [LANGUAGES_LIST[1]], // אנגלית
  },
  {
    id: "9",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "גלית גיאת",
    gender: "female",
    birth_year: 1971,
    phone: "050-333-8899",
    email: "",
    is_singer: true,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "תל אביב",
    skills: [SKILLS_LIST[1], SKILLS_LIST[0]], // שירה, משחק
    languages: [LANGUAGES_LIST[1]], // אנגלית
  },
  {
    id: "10",
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    full_name: "ענת וקסמן",
    gender: "female",
    birth_year: 1961,
    phone: "052-777-4411",
    email: "",
    is_singer: false,
    is_course_grad: false,
    vat_status: "ptor",
    image_url: "",
    notes: "",
    city: "תל אביב",
    skills: [SKILLS_LIST[0], SKILLS_LIST[2]], // משחק, קריינות
    languages: [LANGUAGES_LIST[1]], // אנגלית
  },
]

export const mockProjects: CastingProject[] = []

export const mockFolders: Folder[] = []
