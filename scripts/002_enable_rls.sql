-- הפעלת Row Level Security (RLS) על כל הטבלאות
ALTER TABLE public.actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.casting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.folder_actors ENABLE ROW LEVEL SECURITY;

-- מדיניות גישה ציבורית (כרגע אין אימות משתמשים)
-- כל אחד יכול לקרוא, לכתוב, לעדכן ולמחוק
-- אם בעתיד תרצה אימות משתמשים, נשנה את המדיניות

CREATE POLICY "allow_all_actors" ON public.actors
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_casting_projects" ON public.casting_projects
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_folders" ON public.folders
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_project_actors" ON public.project_actors
  FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "allow_all_folder_actors" ON public.folder_actors
  FOR ALL USING (true) WITH CHECK (true);
