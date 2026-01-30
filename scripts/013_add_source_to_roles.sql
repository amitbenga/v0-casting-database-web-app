-- Add source to project_roles to track if a role was created manually or from a script
ALTER TABLE public.project_roles ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual';

-- Add comment for clarity
COMMENT ON COLUMN public.project_roles.source IS 'The source of the role: manual or script.';
