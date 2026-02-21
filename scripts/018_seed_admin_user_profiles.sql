-- Migration 018: Seed admin user profiles
-- The user_profiles table was empty, which caused ALL RLS policies to block
-- INSERT/UPDATE/DELETE operations on actors, actor_submissions, and casting_projects.
-- This migration adds the existing auth.users as admins.

INSERT INTO public.user_profiles (id, email, full_name, role, created_at, updated_at)
VALUES 
  ('b3d78562-7630-41e1-b845-de86d617f288', 'lenny@sc-produb.com', 'Lenny', 'admin', NOW(), NOW()),
  ('e89b00b9-0109-4dbb-8b9d-24d4d126e468', 'sharon@sc-produb.com', 'Sharon', 'admin', NOW(), NOW()),
  ('e432947f-a12b-4e69-a38a-72ff64d07e23', 'amit@madrasafree.com', 'Amit', 'admin', NOW(), NOW())
ON CONFLICT (id) DO NOTHING;
