-- 1. Add Unique constraint to role_conflicts for upsert support
ALTER TABLE role_conflicts 
ADD CONSTRAINT role_conflicts_unique_combination 
UNIQUE (project_id, role_id_a, role_id_b);

-- 2. Setup RLS Policies for new tables
-- We allow authenticated users to perform all operations for now to match the app's existing pattern

-- project_scripts
DROP POLICY IF EXISTS "Allow authenticated users to manage project_scripts" ON project_scripts;
CREATE POLICY "Allow authenticated users to manage project_scripts" 
ON project_scripts FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- script_extracted_roles
DROP POLICY IF EXISTS "Allow authenticated users to manage script_extracted_roles" ON script_extracted_roles;
CREATE POLICY "Allow authenticated users to manage script_extracted_roles" 
ON script_extracted_roles FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- script_casting_warnings
DROP POLICY IF EXISTS "Allow authenticated users to manage script_casting_warnings" ON script_casting_warnings;
CREATE POLICY "Allow authenticated users to manage script_casting_warnings" 
ON script_casting_warnings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- role_castings
DROP POLICY IF EXISTS "Allow authenticated users to manage role_castings" ON role_castings;
CREATE POLICY "Allow authenticated users to manage role_castings" 
ON role_castings FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- role_conflicts
DROP POLICY IF EXISTS "Allow authenticated users to manage role_conflicts" ON role_conflicts;
CREATE POLICY "Allow authenticated users to manage role_conflicts" 
ON role_conflicts FOR ALL 
TO authenticated 
USING (true) 
WITH CHECK (true);

-- Ensure RLS is enabled on all tables
ALTER TABLE project_scripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_extracted_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE script_casting_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_castings ENABLE ROW LEVEL SECURITY;
ALTER TABLE role_conflicts ENABLE ROW LEVEL SECURITY;
