-- יצירת טבלת שחקנים
CREATE TABLE IF NOT EXISTS public.actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  gender TEXT CHECK (gender IN ('זכר', 'נקבה')),
  birth_year INTEGER,
  phone TEXT,
  email TEXT,
  notes TEXT,
  is_singer BOOLEAN DEFAULT false,
  is_course_graduate BOOLEAN DEFAULT false,
  vat_status TEXT CHECK (vat_status IN ('עוסק מורשה', 'עוסק פטור', 'לא עוסק')),
  skills TEXT[], -- מערך של כישורים
  languages TEXT[], -- מערך של שפות
  photo TEXT, -- base64 של תמונה
  voice_file TEXT, -- base64 של קובץ קול
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- יצירת טבלת פרויקטים
CREATE TABLE IF NOT EXISTS public.casting_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'פעיל',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- יצירת טבלת תיקיות
CREATE TABLE IF NOT EXISTS public.folders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  color TEXT DEFAULT '#3b82f6',
  description TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- טבלת קשר בין שחקנים לפרויקטים
CREATE TABLE IF NOT EXISTS public.project_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id UUID REFERENCES public.casting_projects(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.actors(id) ON DELETE CASCADE,
  role TEXT,
  status TEXT DEFAULT 'שקול',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, actor_id)
);

-- טבלת קשר בין שחקנים לתיקיות
CREATE TABLE IF NOT EXISTS public.folder_actors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  folder_id UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  actor_id UUID REFERENCES public.actors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folder_id, actor_id)
);

-- אינדקסים לביצועים טובים יותר
CREATE INDEX IF NOT EXISTS idx_actors_gender ON public.actors(gender);
CREATE INDEX IF NOT EXISTS idx_actors_birth_year ON public.actors(birth_year);
CREATE INDEX IF NOT EXISTS idx_actors_is_singer ON public.actors(is_singer);
CREATE INDEX IF NOT EXISTS idx_actors_is_course_graduate ON public.actors(is_course_graduate);
CREATE INDEX IF NOT EXISTS idx_project_actors_project_id ON public.project_actors(project_id);
CREATE INDEX IF NOT EXISTS idx_project_actors_actor_id ON public.project_actors(actor_id);
CREATE INDEX IF NOT EXISTS idx_folder_actors_folder_id ON public.folder_actors(folder_id);
CREATE INDEX IF NOT EXISTS idx_folder_actors_actor_id ON public.folder_actors(actor_id);

-- פונקציה לעדכון updated_at אוטומטית
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- טריגרים לעדכון updated_at
DROP TRIGGER IF EXISTS update_actors_updated_at ON public.actors;
CREATE TRIGGER update_actors_updated_at
  BEFORE UPDATE ON public.actors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_casting_projects_updated_at ON public.casting_projects;
CREATE TRIGGER update_casting_projects_updated_at
  BEFORE UPDATE ON public.casting_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_folders_updated_at ON public.folders;
CREATE TRIGGER update_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();
