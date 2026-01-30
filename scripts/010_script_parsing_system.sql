-- A) project_roles updates
ALTER TABLE project_roles 
ADD COLUMN IF NOT EXISTS parent_role_id UUID REFERENCES project_roles(id),
ADD COLUMN IF NOT EXISTS role_name_normalized TEXT;

-- Update role_name_normalized for existing roles (simple normalization)
UPDATE project_roles SET role_name_normalized = LOWER(TRIM(role_name)) WHERE role_name_normalized IS NULL;

-- Add indexes for project_roles
CREATE INDEX IF NOT EXISTS idx_project_roles_project_id ON project_roles(project_id);
CREATE INDEX IF NOT EXISTS idx_project_roles_parent_role_id ON project_roles(parent_role_id);

-- Logical uniqueness (using role_name_normalized if we want to be strict, but let's stick to project_id and role_name for now as per instructions)
-- ALTER TABLE project_roles ADD CONSTRAINT unique_project_role UNIQUE (project_id, role_name);

-- B) Create role_castings table
CREATE TABLE IF NOT EXISTS role_castings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES casting_projects(id) ON DELETE CASCADE,
    role_id UUID REFERENCES project_roles(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES actors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'בליהוק', -- באודישן | בליהוק | מלוהק
    notes TEXT,
    replicas_planned INT DEFAULT 0,
    replicas_final INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(role_id) -- As per instructions: "לכל role שחקן נבחר אחד"
);

-- C) Create role_conflicts table
CREATE TABLE IF NOT EXISTS role_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES casting_projects(id) ON DELETE CASCADE,
    role_id_a UUID REFERENCES project_roles(id) ON DELETE CASCADE,
    role_id_b UUID REFERENCES project_roles(id) ON DELETE CASCADE,
    warning_type TEXT NOT NULL, -- same_scene | group_scene | dialogue | other
    scene_reference TEXT,
    evidence_json JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    CONSTRAINT unique_project_role_conflict UNIQUE(project_id, role_id_a, role_id_b),
    CONSTRAINT role_order CHECK (role_id_a < role_id_b)
);

-- D) script_casting_warnings update
ALTER TABLE script_casting_warnings
ADD COLUMN IF NOT EXISTS role_id_a UUID REFERENCES project_roles(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS role_id_b UUID REFERENCES project_roles(id) ON DELETE CASCADE;

-- E) RLS Policies

-- role_castings
ALTER TABLE role_castings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON role_castings FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON role_castings FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON role_castings FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON role_castings FOR DELETE USING (true);

-- role_conflicts
ALTER TABLE role_conflicts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Enable read access for all users" ON role_conflicts FOR SELECT USING (true);
CREATE POLICY "Enable insert for all users" ON role_conflicts FOR INSERT WITH CHECK (true);
CREATE POLICY "Enable update for all users" ON role_conflicts FOR UPDATE USING (true);
CREATE POLICY "Enable delete for all users" ON role_conflicts FOR DELETE USING (true);

-- Ensure script tables exist (from project context)
CREATE TABLE IF NOT EXISTS project_scripts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES casting_projects(id) ON DELETE CASCADE,
    file_name TEXT NOT NULL,
    file_url TEXT,
    file_type TEXT,
    file_size_bytes BIGINT,
    processing_status TEXT DEFAULT 'uploaded', -- uploaded | processing | completed | error
    processing_error TEXT,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS script_extracted_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES casting_projects(id) ON DELETE CASCADE,
    script_id UUID REFERENCES project_scripts(id) ON DELETE CASCADE,
    role_name TEXT NOT NULL,
    role_type TEXT DEFAULT 'regular', -- regular | combined | group | ambiguous
    replicas_count INT DEFAULT 0,
    first_appearance_script TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS script_casting_warnings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES casting_projects(id) ON DELETE CASCADE,
    role_1_name TEXT NOT NULL,
    role_2_name TEXT NOT NULL,
    scene_reference TEXT,
    warning_type TEXT DEFAULT 'same_scene',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
