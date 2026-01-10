-- ================================================
-- Authentication & Row Level Security Setup
-- ================================================
-- This script sets up user authentication and RLS policies
-- Run this in Supabase SQL Editor

-- ================================================
-- 1. Enable Row Level Security on all tables
-- ================================================

ALTER TABLE actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE actor_submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE casting_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_actors ENABLE ROW LEVEL SECURITY;
ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
ALTER TABLE folder_actors ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 2. Create user_profiles table to extend auth.users
-- ================================================

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'viewer')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- ================================================
-- 3. RLS Policies for user_profiles
-- ================================================

-- Users can read their own profile
CREATE POLICY "Users can read own profile"
  ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Users can update their own profile
CREATE POLICY "Users can update own profile"
  ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id);

-- ================================================
-- 4. RLS Policies for actors
-- ================================================

-- All authenticated users can read actors
CREATE POLICY "Authenticated users can read actors"
  ON actors
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can insert actors
CREATE POLICY "Admins can insert actors"
  ON actors
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can update actors
CREATE POLICY "Admins can update actors"
  ON actors
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete actors
CREATE POLICY "Admins can delete actors"
  ON actors
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- 5. RLS Policies for actor_submissions
-- ================================================

-- All authenticated users can read submissions
CREATE POLICY "Authenticated users can read submissions"
  ON actor_submissions
  FOR SELECT
  TO authenticated
  USING (true);

-- Anyone can insert submissions (public intake form)
CREATE POLICY "Anyone can insert submissions"
  ON actor_submissions
  FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Only admins can update submissions
CREATE POLICY "Admins can update submissions"
  ON actor_submissions
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Only admins can delete submissions
CREATE POLICY "Admins can delete submissions"
  ON actor_submissions
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- 6. RLS Policies for casting_projects
-- ================================================

-- All authenticated users can read projects
CREATE POLICY "Authenticated users can read projects"
  ON casting_projects
  FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage projects
CREATE POLICY "Admins can insert projects"
  ON casting_projects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can update projects"
  ON casting_projects
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admins can delete projects"
  ON casting_projects
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- 7. RLS Policies for project_actors
-- ================================================

CREATE POLICY "Authenticated users can read project_actors"
  ON project_actors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage project_actors"
  ON project_actors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- 8. RLS Policies for folders
-- ================================================

CREATE POLICY "Authenticated users can read folders"
  ON folders
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage folders"
  ON folders
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- 9. RLS Policies for folder_actors
-- ================================================

CREATE POLICY "Authenticated users can read folder_actors"
  ON folder_actors
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins can manage folder_actors"
  ON folder_actors
  FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ================================================
-- 10. Function to create user profile automatically
-- ================================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.email),
    COALESCE(NEW.raw_user_meta_data->>'role', 'viewer')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create profile on signup
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_new_user();

-- ================================================
-- 11. MANUAL STEP: Create users in Supabase Dashboard
-- ================================================

-- Go to Supabase Dashboard → Authentication → Users → Add User
-- 
-- User 1 (Leni - Admin):
-- Email: leni@madrasafree.org
-- Password: [Choose a strong password]
-- User Metadata: {"full_name": "Leni", "role": "admin"}
--
-- User 2 (Sharon - Admin):
-- Email: sharon@madrasafree.org
-- Password: [Choose a strong password]
-- User Metadata: {"full_name": "Sharon", "role": "admin"}
--
-- After creating users, their profiles will be created automatically via trigger

-- ================================================
-- 12. Grant necessary permissions
-- ================================================

GRANT USAGE ON SCHEMA public TO authenticated, anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ================================================
-- VERIFICATION QUERIES
-- ================================================

-- Check RLS is enabled:
-- SELECT tablename, rowsecurity FROM pg_tables WHERE schemaname = 'public';

-- Check policies:
-- SELECT * FROM pg_policies WHERE schemaname = 'public';

-- Check user profiles:
-- SELECT * FROM user_profiles;
