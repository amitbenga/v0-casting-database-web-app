-- Add applied_at to project_scripts to track when the script results were applied to the project
ALTER TABLE public.project_scripts ADD COLUMN IF NOT EXISTS applied_at TIMESTAMP WITH TIME ZONE;

-- Add comment for clarity
COMMENT ON COLUMN public.project_scripts.applied_at IS 'Timestamp when the extracted roles and warnings were applied to the project roles and conflicts.';
