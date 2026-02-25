-- Migration 019: Fix RLS policies to allow public access
-- The app handles auth at the application level, not via Supabase Auth
-- All RLS policies are updated to allow anon access

-- actors
DROP POLICY IF EXISTS "Authenticated users can read actors" ON public.actors;
DROP POLICY IF EXISTS "Admins can insert actors" ON public.actors;
DROP POLICY IF EXISTS "Admins can update actors" ON public.actors;
DROP POLICY IF EXISTS "Admins can delete actors" ON public.actors;
CREATE POLICY "Allow read access for all users" ON public.actors FOR SELECT USING (true);
CREATE POLICY "Allow insert for all users" ON public.actors FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all users" ON public.actors FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for all users" ON public.actors FOR DELETE USING (true);

-- actor_submissions
DROP POLICY IF EXISTS "Allow authenticated users to read submissions" ON public.actor_submissions;
DROP POLICY IF EXISTS "Admins can read submissions" ON public.actor_submissions;
DROP POLICY IF EXISTS "Anyone can submit" ON public.actor_submissions;
DROP POLICY IF EXISTS "Allow public to insert submissions" ON public.actor_submissions;
DROP POLICY IF EXISTS "Admins can update submissions" ON public.actor_submissions;
CREATE POLICY "Allow read access for all users" ON public.actor_submissions FOR SELECT USING (true);
CREATE POLICY "Allow insert for all users" ON public.actor_submissions FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all users" ON public.actor_submissions FOR UPDATE USING (true) WITH CHECK (true);

-- casting_projects
DROP POLICY IF EXISTS "Authenticated users can read projects" ON public.casting_projects;
DROP POLICY IF EXISTS "Admins can insert projects" ON public.casting_projects;
DROP POLICY IF EXISTS "Admins can update projects" ON public.casting_projects;
DROP POLICY IF EXISTS "Admins can delete projects" ON public.casting_projects;
CREATE POLICY "Allow read access for all users" ON public.casting_projects FOR SELECT USING (true);
CREATE POLICY "Allow insert for all users" ON public.casting_projects FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all users" ON public.casting_projects FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for all users" ON public.casting_projects FOR DELETE USING (true);

-- project_roles
DROP POLICY IF EXISTS "Authenticated users can read project_roles" ON public.project_roles;
DROP POLICY IF EXISTS "Admins can insert project_roles" ON public.project_roles;
DROP POLICY IF EXISTS "Admins can update project_roles" ON public.project_roles;
DROP POLICY IF EXISTS "Admins can delete project_roles" ON public.project_roles;
CREATE POLICY "Allow read access for all users" ON public.project_roles FOR SELECT USING (true);
CREATE POLICY "Allow insert for all users" ON public.project_roles FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow update for all users" ON public.project_roles FOR UPDATE USING (true) WITH CHECK (true);
CREATE POLICY "Allow delete for all users" ON public.project_roles FOR DELETE USING (true);
