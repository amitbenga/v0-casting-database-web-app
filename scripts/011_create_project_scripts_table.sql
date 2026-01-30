-- ===================================
-- Create project_scripts table
-- ===================================

CREATE TABLE IF NOT EXISTS project_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT NOT NULL,
    file_type TEXT,
    file_size_bytes INTEGER,
    processing_status TEXT DEFAULT 'uploaded' CHECK (processing_status IN ('uploaded', 'processing', 'completed', 'error')),
    processing_error TEXT,
    processed_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index for project lookups
CREATE INDEX IF NOT EXISTS idx_project_scripts_project ON project_scripts(project_id);

-- ===================================
-- Create script_extracted_roles table
-- ===================================

CREATE TABLE IF NOT EXISTS script_extracted_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    script_id UUID NOT NULL REFERENCES project_scripts(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    role_type TEXT DEFAULT 'regular' CHECK (role_type IN ('regular', 'combined', 'group', 'ambiguous')),
    parent_role_name TEXT,
    replicas_count INTEGER DEFAULT 0,
    first_appearance_script TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_script_extracted_roles_project ON script_extracted_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_script_extracted_roles_script ON script_extracted_roles(script_id);

-- ===================================
-- Create script_casting_warnings table (for conflicts from script)
-- ===================================

CREATE TABLE IF NOT EXISTS script_casting_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    script_id UUID NOT NULL REFERENCES project_scripts(id) ON DELETE CASCADE,
    role_1_name TEXT NOT NULL,
    role_2_name TEXT NOT NULL,
    scene_reference TEXT,
    warning_type TEXT DEFAULT 'same_scene' CHECK (warning_type IN ('same_scene', 'other')),
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index
CREATE INDEX IF NOT EXISTS idx_script_casting_warnings_project ON script_casting_warnings(project_id);
CREATE INDEX IF NOT EXISTS idx_script_casting_warnings_script ON script_casting_warnings(script_id);

-- ===================================
-- Enable RLS and create policies
-- ===================================

-- Enable RLS
ALTER TABLE project_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_extracted_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_casting_warnings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Allow all for project_scripts" ON project_scripts;
DROP POLICY IF EXISTS "Allow all for script_extracted_roles" ON script_extracted_roles;
DROP POLICY IF EXISTS "Allow all for script_casting_warnings" ON script_casting_warnings;

-- Create permissive policies (allow all operations for now)
-- In production, you'd want to restrict this to authenticated users
CREATE POLICY "Allow all for project_scripts" ON project_scripts
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for script_extracted_roles" ON script_extracted_roles
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Allow all for script_casting_warnings" ON script_casting_warnings
    FOR ALL USING (true) WITH CHECK (true);
