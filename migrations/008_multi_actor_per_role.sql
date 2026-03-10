-- Migration 008: Allow multiple actors per role
-- Changes UNIQUE(role_id) to UNIQUE(role_id, actor_id) on role_castings
-- This enables assigning multiple actors to the same role (e.g. one מלוהק + several באודישן)

-- Drop the old single-actor constraint
ALTER TABLE role_castings DROP CONSTRAINT IF EXISTS role_castings_role_id_key;

-- Add the new multi-actor constraint
ALTER TABLE role_castings ADD CONSTRAINT role_castings_role_id_actor_id_key UNIQUE (role_id, actor_id);

-- Update table comment
COMMENT ON TABLE role_castings IS 'Stores actor assignments to roles. Multiple actors can be assigned per role, but only one should have status מלוהק.';
