-- Migration: Create role_castings and role_conflicts tables
-- This replaces the old project_actors approach with a role-centric casting system

-- ===================================
-- 1. Update project_roles table
-- ===================================

-- Add missing columns to project_roles if they don't exist
ALTER TABLE project_roles 
ADD COLUMN IF NOT EXISTS parent_role_id UUID REFERENCES project_roles(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual' CHECK (source IN ('manual', 'script')),
ADD COLUMN IF NOT EXISTS replicas_count INTEGER DEFAULT 0;

-- Copy replicas_needed to replicas_count if exists
UPDATE project_roles 
SET replicas_count = COALESCE(replicas_needed, 0)
WHERE replicas_count = 0 OR replicas_count IS NULL;

-- Create index for parent-child hierarchy
CREATE INDEX IF NOT EXISTS idx_project_roles_parent ON project_roles(parent_role_id);

-- ===================================
-- 2. Create role_castings table
-- ===================================

CREATE TABLE IF NOT EXISTS role_castings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    role_id UUID NOT NULL REFERENCES project_roles(id) ON DELETE CASCADE,
    actor_id UUID NOT NULL REFERENCES actors(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'באודישן' CHECK (status IN ('באודישן', 'בליהוק', 'מלוהק')),
    replicas_planned INTEGER,
    replicas_final INTEGER,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Each role can only have one casting at a time
    UNIQUE (role_id)
);

-- Indexes for role_castings
CREATE INDEX IF NOT EXISTS idx_role_castings_role ON role_castings(role_id);
CREATE INDEX IF NOT EXISTS idx_role_castings_actor ON role_castings(actor_id);

-- ===================================
-- 3. Create role_conflicts table
-- ===================================

CREATE TABLE IF NOT EXISTS role_conflicts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID NOT NULL REFERENCES casting_projects(id) ON DELETE CASCADE,
    role_1_id UUID REFERENCES project_roles(id) ON DELETE CASCADE,
    role_2_id UUID REFERENCES project_roles(id) ON DELETE CASCADE,
    role_1_name TEXT,
    role_2_name TEXT,
    scene_reference TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Prevent duplicate conflicts
    UNIQUE (project_id, role_1_id, role_2_id)
);

-- Index for conflict lookups
CREATE INDEX IF NOT EXISTS idx_role_conflicts_project ON role_conflicts(project_id);
CREATE INDEX IF NOT EXISTS idx_role_conflicts_roles ON role_conflicts(role_1_id, role_2_id);

-- ===================================
-- 4. Enable RLS
-- ===================================

ALTER TABLE role_castings ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_conflicts ENABLE ROW LEVEL SECURITY;

-- Create policies for role_castings
DROP POLICY IF EXISTS "Allow all role_castings access" ON role_castings;
CREATE POLICY "Allow all role_castings access" ON role_castings
    FOR ALL USING (true) WITH CHECK (true);

-- Create policies for role_conflicts  
DROP POLICY IF EXISTS "Allow all role_conflicts access" ON role_conflicts;
CREATE POLICY "Allow all role_conflicts access" ON role_conflicts
    FOR ALL USING (true) WITH CHECK (true);

-- ===================================
-- 5. Migrate existing data (if any)
-- ===================================

-- Migrate from project_actors to role_castings (only if project_actors has role_id)
INSERT INTO role_castings (role_id, actor_id, status, replicas_planned, replicas_final, notes, created_at)
SELECT 
    pa.role_id,
    pa.actor_id,
    CASE 
        WHEN pa.status IN ('באודישן', 'בליהוק', 'מלוהק') THEN pa.status
        ELSE 'באודישן'
    END,
    pa.replicas_planned,
    pa.replicas_final,
    pa.notes,
    pa.created_at
FROM project_actors pa
WHERE pa.role_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM role_castings rc WHERE rc.role_id = pa.role_id
);

-- ===================================
-- 6. Add comments for documentation
-- ===================================

COMMENT ON TABLE role_castings IS 'Stores actor assignments to roles. Each role can have one assigned actor at a time.';
COMMENT ON COLUMN role_castings.status IS 'Casting status: באודישן (auditioning), בליהוק (casting), מלוהק (cast)';
COMMENT ON COLUMN role_castings.replicas_planned IS 'Planned number of replicas for this actor in this role';
COMMENT ON COLUMN role_castings.replicas_final IS 'Final number of replicas recorded';

COMMENT ON TABLE role_conflicts IS 'Defines which role pairs cannot be played by the same actor (usually same-scene conflicts)';
COMMENT ON COLUMN role_conflicts.scene_reference IS 'Reference to the script scene where the conflict occurs';
