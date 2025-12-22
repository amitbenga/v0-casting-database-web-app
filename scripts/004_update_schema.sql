-- עדכון schema להתאמה לדרישות המדויקות
-- מחיקת הטבלאות הישנות ויצירת חדשות עם השדות הנכונים

DROP TABLE IF EXISTS public.folder_actors CASCADE;
DROP TABLE IF EXISTS public.project_actors CASCADE;
DROP TABLE IF EXISTS public.folders CASCADE;
DROP TABLE IF EXISTS public.casting_projects CASCADE;
DROP TABLE IF EXISTS public.actors CASCADE;

-- יצירת טבלת שחקנים מחדש עם השדות המדויקים
CREATE TABLE public.actors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  full_name TEXT NOT NULL,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female')),
  birth_year INTEGER NOT NULL,
  phone TEXT NOT NULL,
  email TEXT DEFAULT '',
  is_singer BOOLEAN DEFAULT false,
  is_course_grad BOOLEAN DEFAULT false,
  vat_status TEXT NOT NULL CHECK (vat_status IN ('ptor', 'murshe', 'artist_salary')),
  image_url TEXT DEFAULT '',
  voice_sample_url TEXT DEFAULT '',
  other_lang_text TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  city TEXT DEFAULT '',
  skills JSONB DEFAULT '[]'::jsonb,
  languages JSONB DEFAULT '[]'::jsonb
);

-- יצירת טבלת פרויקטים
CREATE TABLE public.casting_projects (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'casting', 'casted', 'recording', 'completed')),
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- טבלת תפקידים בפרויקט
CREATE TABLE public.project_actors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id TEXT REFERENCES public.casting_projects(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES public.actors(id) ON DELETE CASCADE,
  role_name TEXT NOT NULL,
  replicas_planned INTEGER DEFAULT 0,
  replicas_final INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(project_id, actor_id, role_name)
);

-- יצירת טבלת תיקיות
CREATE TABLE public.folders (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- טבלת קשר בין שחקנים לתיקיות
CREATE TABLE public.folder_actors (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  folder_id TEXT REFERENCES public.folders(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES public.actors(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(folder_id, actor_id)
);

-- יצירת טבלת מועדפים
CREATE TABLE public.favorites (
  id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  actor_id TEXT REFERENCES public.actors(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL CHECK (user_id IN ('leni', 'father')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(actor_id, user_id)
);

-- אינדקסים
CREATE INDEX idx_actors_gender ON public.actors(gender);
CREATE INDEX idx_actors_birth_year ON public.actors(birth_year);
CREATE INDEX idx_actors_is_singer ON public.actors(is_singer);
CREATE INDEX idx_actors_is_course_grad ON public.actors(is_course_grad);
CREATE INDEX idx_project_actors_project_id ON public.project_actors(project_id);
CREATE INDEX idx_project_actors_actor_id ON public.project_actors(actor_id);
CREATE INDEX idx_folder_actors_folder_id ON public.folder_actors(folder_id);
CREATE INDEX idx_folder_actors_actor_id ON public.folder_actors(actor_id);

-- טריגרים לעדכון updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_actors_updated_at
  BEFORE UPDATE ON public.actors
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_casting_projects_updated_at
  BEFORE UPDATE ON public.casting_projects
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

CREATE POLICY "allow_all_actors" ON public.actors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_casting_projects" ON public.casting_projects FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_folders" ON public.folders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_project_actors" ON public.project_actors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_folder_actors" ON public.folder_actors FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_favorites" ON public.favorites FOR ALL USING (true) WITH CHECK (true);
