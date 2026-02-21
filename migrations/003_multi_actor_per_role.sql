-- Migration 003: Allow multiple actors per role
-- Run this in Supabase SQL Editor before deploying the code changes.

-- 1. Drop old unique constraint on role_id alone (one actor per role)
ALTER TABLE role_castings DROP CONSTRAINT IF EXISTS role_castings_role_id_key;

-- 2. Add new unique constraint: same actor cannot be assigned twice to the same role
ALTER TABLE role_castings
  ADD CONSTRAINT role_castings_role_id_actor_id_key UNIQUE (role_id, actor_id);
