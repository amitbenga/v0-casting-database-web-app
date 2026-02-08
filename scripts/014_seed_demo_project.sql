-- Seed a demo project: "The Kingdom of Shadows" with ~40 roles
-- Project metadata in Hebrew, role names in English (as they come from scripts)

-- 1. Create the project
INSERT INTO casting_projects (id, name, status, notes, director, casting_director, project_date, created_at, updated_at)
VALUES (
  'demo-kingdom-001',
  'ממלכת הצללים',
  'active',
  'סרט אנימציה פנטזיה - 13 פרקים. תסריט מלא הועלה ועובד.',
  'דנה כהן',
  'יובל לוי',
  '2026-06-15',
  NOW(),
  NOW()
)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  status = EXCLUDED.status,
  notes = EXCLUDED.notes,
  director = EXCLUDED.director,
  casting_director = EXCLUDED.casting_director;

-- 2. Create roles (parent roles first, then children)

-- Main characters
INSERT INTO project_roles (id, project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES
  ('r-001', 'demo-kingdom-001', 'KING ALDRIC', 'king aldric', 187, 'script', 'The aging king struggling to hold his kingdom together'),
  ('r-002', 'demo-kingdom-001', 'QUEEN ELARA', 'queen elara', 156, 'script', 'The queen with a secret alliance to the shadow realm'),
  ('r-003', 'demo-kingdom-001', 'PRINCE ROWAN', 'prince rowan', 234, 'script', 'The rebellious young prince, protagonist'),
  ('r-004', 'demo-kingdom-001', 'PRINCESS LIORA', 'princess liora', 198, 'script', 'Twin sister of Rowan, gifted with shadow magic'),
  ('r-005', 'demo-kingdom-001', 'SHADOW LORD MALAKAI', 'shadow lord malakai', 142, 'script', 'Main antagonist, ruler of the shadow realm'),
  ('r-006', 'demo-kingdom-001', 'CAPTAIN THORNE', 'captain thorne', 112, 'script', 'Head of the royal guard, loyal to the king'),
  ('r-007', 'demo-kingdom-001', 'WIZARD FENWICK', 'wizard fenwick', 89, 'script', 'Court wizard, comic relief'),
  ('r-008', 'demo-kingdom-001', 'LADY SERAPHINA', 'lady seraphina', 76, 'script', 'Spy for the shadow realm disguised as a noble'),
  ('r-009', 'demo-kingdom-001', 'GRIMJAW', 'grimjaw', 67, 'script', 'Shadow creature, Malakais lieutenant'),
  ('r-010', 'demo-kingdom-001', 'NARRATOR', 'narrator', 45, 'script', 'Story narrator, appears in episode openings'),
  
  -- Supporting characters
  ('r-011', 'demo-kingdom-001', 'BLACKSMITH GORREN', 'blacksmith gorren', 34, 'script', 'Village blacksmith who helps the prince'),
  ('r-012', 'demo-kingdom-001', 'TAVERN KEEPER MOLLY', 'tavern keeper molly', 28, 'script', 'Information broker disguised as tavern keeper'),
  ('r-013', 'demo-kingdom-001', 'GENERAL VOSS', 'general voss', 41, 'script', 'Military general, secretly plotting a coup'),
  ('r-014', 'demo-kingdom-001', 'PRIESTESS AYLA', 'priestess ayla', 38, 'script', 'Temple priestess who knows ancient prophecies'),
  ('r-015', 'demo-kingdom-001', 'MERCHANT HASSAN', 'merchant hassan', 22, 'script', 'Traveling merchant with connections everywhere'),
  ('r-016', 'demo-kingdom-001', 'ELDER SAGE', 'elder sage', 31, 'script', 'Ancient wise man living in the mountains'),
  ('r-017', 'demo-kingdom-001', 'SCOUT WREN', 'scout wren', 19, 'script', 'Young forest scout, Rowans ally'),
  ('r-018', 'demo-kingdom-001', 'JESTER PUCK', 'jester puck', 25, 'script', 'Court jester who speaks truth through jokes'),
  ('r-019', 'demo-kingdom-001', 'STABLE BOY FINN', 'stable boy finn', 15, 'script', 'Orphan boy working in the royal stables'),
  ('r-020', 'demo-kingdom-001', 'HEALER MIRA', 'healer mira', 20, 'script', 'Village healer with herbal knowledge'),
  
  -- Minor characters
  ('r-021', 'demo-kingdom-001', 'GUARD #1', 'guard #1', 8, 'script', NULL),
  ('r-022', 'demo-kingdom-001', 'GUARD #2', 'guard #2', 6, 'script', NULL),
  ('r-023', 'demo-kingdom-001', 'GUARD #3', 'guard #3', 4, 'script', NULL),
  ('r-024', 'demo-kingdom-001', 'VILLAGE WOMAN', 'village woman', 7, 'script', NULL),
  ('r-025', 'demo-kingdom-001', 'VILLAGE MAN', 'village man', 5, 'script', NULL),
  ('r-026', 'demo-kingdom-001', 'SHADOW SOLDIER', 'shadow soldier', 12, 'script', 'Generic shadow army soldiers'),
  ('r-027', 'demo-kingdom-001', 'MESSENGER', 'messenger', 9, 'script', NULL),
  ('r-028', 'demo-kingdom-001', 'COUNCIL MEMBER #1', 'council member #1', 11, 'script', NULL),
  ('r-029', 'demo-kingdom-001', 'COUNCIL MEMBER #2', 'council member #2', 8, 'script', NULL),
  ('r-030', 'demo-kingdom-001', 'COUNCIL MEMBER #3', 'council member #3', 6, 'script', NULL),
  ('r-031', 'demo-kingdom-001', 'DRAGON VOICE', 'dragon voice', 14, 'script', 'Voice of the ancient dragon'),
  ('r-032', 'demo-kingdom-001', 'CROWD', 'crowd', 18, 'script', 'Group scenes - crowd reactions'),
  ('r-033', 'demo-kingdom-001', 'CHILD IN VILLAGE', 'child in village', 3, 'script', NULL),
  ('r-034', 'demo-kingdom-001', 'OLD FARMER', 'old farmer', 4, 'script', NULL),
  ('r-035', 'demo-kingdom-001', 'SHIP CAPTAIN', 'ship captain', 7, 'script', 'Appears in episodes 8-9'),
  ('r-036', 'demo-kingdom-001', 'PIRATE VOICE', 'pirate voice', 5, 'script', 'Radio communication voice'),
  ('r-037', 'demo-kingdom-001', 'KNIGHT COMMANDER', 'knight commander', 16, 'script', 'Leads the knights in battle scenes'),
  ('r-038', 'demo-kingdom-001', 'WITCH OF THE WOODS', 'witch of the woods', 13, 'script', 'Mysterious witch helping from the shadows')
ON CONFLICT (id) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  replicas_needed = EXCLUDED.replicas_needed,
  source = EXCLUDED.source,
  description = EXCLUDED.description;

-- 3. Create child/variant roles (same character, different casting)
INSERT INTO project_roles (id, project_id, role_name, role_name_normalized, replicas_needed, source, parent_role_id, description)
VALUES
  ('r-003-y', 'demo-kingdom-001', 'YOUNG ROWAN', 'young rowan', 24, 'script', 'r-003', 'Prince Rowan as a child in flashbacks'),
  ('r-004-y', 'demo-kingdom-001', 'YOUNG LIORA', 'young liora', 18, 'script', 'r-004', 'Princess Liora as a child in flashbacks'),
  ('r-001-y', 'demo-kingdom-001', 'YOUNG ALDRIC', 'young aldric', 12, 'script', 'r-001', 'King Aldric in flashback scenes'),
  ('r-005-p', 'demo-kingdom-001', 'MALAKAI (HUMAN FORM)', 'malakai human form', 28, 'script', 'r-005', 'Malakai before becoming the Shadow Lord')
ON CONFLICT (id) DO UPDATE SET
  role_name = EXCLUDED.role_name,
  replicas_needed = EXCLUDED.replicas_needed,
  parent_role_id = EXCLUDED.parent_role_id,
  description = EXCLUDED.description;

-- 4. Create role conflicts (characters that share scenes = same actor cant play both)
INSERT INTO role_conflicts (project_id, role_id_a, role_id_b, warning_type, scene_reference)
VALUES
  ('demo-kingdom-001', 'r-003', 'r-004', 'same_scene', 'Episodes 1-13: Twins appear together in most scenes'),
  ('demo-kingdom-001', 'r-001', 'r-005', 'same_scene', 'Episodes 6, 10, 13: King confronts Shadow Lord'),
  ('demo-kingdom-001', 'r-001', 'r-002', 'same_scene', 'Episodes 1-5, 7, 12: King and Queen scenes'),
  ('demo-kingdom-001', 'r-003', 'r-006', 'same_scene', 'Episodes 2-4, 8: Prince trains with Captain'),
  ('demo-kingdom-001', 'r-005', 'r-009', 'same_scene', 'Episodes 3, 7, 11: Shadow Lord commands Grimjaw'),
  ('demo-kingdom-001', 'r-007', 'r-018', 'same_scene', 'Episodes 2, 5: Wizard and Jester comic duo'),
  ('demo-kingdom-001', 'r-003', 'r-007', 'same_scene', 'Episodes 4-6: Prince seeks Wizards help'),
  ('demo-kingdom-001', 'r-008', 'r-002', 'same_scene', 'Episodes 5, 9: Lady Seraphina attends Queens court'),
  ('demo-kingdom-001', 'r-013', 'r-006', 'same_scene', 'Episodes 7-8: General and Captain clash'),
  ('demo-kingdom-001', 'r-021', 'r-022', 'same_scene', 'Episodes 1, 3: Guards appear together at gate'),
  ('demo-kingdom-001', 'r-028', 'r-029', 'same_scene', 'Episodes 2, 6, 10: Council meetings'),
  ('demo-kingdom-001', 'r-028', 'r-030', 'same_scene', 'Episodes 2, 6, 10: Council meetings'),
  ('demo-kingdom-001', 'r-029', 'r-030', 'same_scene', 'Episodes 2, 6, 10: Council meetings');
