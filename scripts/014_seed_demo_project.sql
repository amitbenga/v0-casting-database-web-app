-- Seed a demo project: "ממלכת הצללים" (Kingdom of Shadows) with ~42 roles
-- Project metadata in Hebrew, role names in English (as they come from scripts)

-- Use a DO block so we can use variables for the generated UUIDs

DO $$
DECLARE
  p_id TEXT := 'demo-kingdom-001';
  -- Main characters
  r01 UUID; r02 UUID; r03 UUID; r04 UUID; r05 UUID;
  r06 UUID; r07 UUID; r08 UUID; r09 UUID; r10 UUID;
  -- Supporting
  r11 UUID; r12 UUID; r13 UUID; r14 UUID; r15 UUID;
  r16 UUID; r17 UUID; r18 UUID; r19 UUID; r20 UUID;
  -- Minor
  r21 UUID; r22 UUID; r23 UUID; r24 UUID; r25 UUID;
  r26 UUID; r27 UUID; r28 UUID; r29 UUID; r30 UUID;
  r31 UUID; r32 UUID; r33 UUID; r34 UUID; r35 UUID;
  r36 UUID; r37 UUID; r38 UUID;
  -- Child variants
  r03y UUID; r04y UUID; r01y UUID; r05p UUID;
BEGIN

-- 1. Upsert the project
INSERT INTO casting_projects (id, name, status, notes, director, casting_director, project_date, created_at, updated_at)
VALUES (
  p_id,
  'ממלכת הצללים',
  'casting',
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
  notes = EXCLUDED.notes;

-- 2. Delete existing roles for this project (clean slate for demo)
DELETE FROM role_conflicts WHERE project_id = p_id;
DELETE FROM role_castings
WHERE role_id IN (
  SELECT id FROM project_roles WHERE project_id = p_id
);
DELETE FROM project_roles WHERE project_id = p_id;

-- 3. Insert main characters
INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'KING ALDRIC', 'king aldric', 187, 'script', 'The aging king struggling to hold his kingdom together')
RETURNING id INTO r01;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'QUEEN ELARA', 'queen elara', 156, 'script', 'The queen with a secret alliance to the shadow realm')
RETURNING id INTO r02;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'PRINCE ROWAN', 'prince rowan', 234, 'script', 'The rebellious young prince, protagonist')
RETURNING id INTO r03;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'PRINCESS LIORA', 'princess liora', 198, 'script', 'Twin sister of Rowan, gifted with shadow magic')
RETURNING id INTO r04;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'SHADOW LORD MALAKAI', 'shadow lord malakai', 142, 'script', 'Main antagonist, ruler of the shadow realm')
RETURNING id INTO r05;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'CAPTAIN THORNE', 'captain thorne', 112, 'script', 'Head of the royal guard, loyal to the king')
RETURNING id INTO r06;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'WIZARD FENWICK', 'wizard fenwick', 89, 'script', 'Court wizard, comic relief')
RETURNING id INTO r07;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'LADY SERAPHINA', 'lady seraphina', 76, 'script', 'Spy for the shadow realm disguised as a noble')
RETURNING id INTO r08;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'GRIMJAW', 'grimjaw', 67, 'script', 'Shadow creature, Malakais lieutenant')
RETURNING id INTO r09;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'NARRATOR', 'narrator', 45, 'script', 'Story narrator, appears in episode openings')
RETURNING id INTO r10;

-- Supporting characters
INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'BLACKSMITH GORREN', 'blacksmith gorren', 34, 'script', 'Village blacksmith who helps the prince')
RETURNING id INTO r11;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'TAVERN KEEPER MOLLY', 'tavern keeper molly', 28, 'script', 'Information broker disguised as tavern keeper')
RETURNING id INTO r12;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'GENERAL VOSS', 'general voss', 41, 'script', 'Military general, secretly plotting a coup')
RETURNING id INTO r13;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'PRIESTESS AYLA', 'priestess ayla', 38, 'script', 'Temple priestess who knows ancient prophecies')
RETURNING id INTO r14;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'MERCHANT HASSAN', 'merchant hassan', 22, 'script', 'Traveling merchant with connections everywhere')
RETURNING id INTO r15;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'ELDER SAGE', 'elder sage', 31, 'script', 'Ancient wise man living in the mountains')
RETURNING id INTO r16;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'SCOUT WREN', 'scout wren', 19, 'script', 'Young forest scout, Rowans ally')
RETURNING id INTO r17;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'JESTER PUCK', 'jester puck', 25, 'script', 'Court jester who speaks truth through jokes')
RETURNING id INTO r18;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'STABLE BOY FINN', 'stable boy finn', 15, 'script', 'Orphan boy working in the royal stables')
RETURNING id INTO r19;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'HEALER MIRA', 'healer mira', 20, 'script', 'Village healer with herbal knowledge')
RETURNING id INTO r20;

-- Minor characters
INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'GUARD #1', 'guard #1', 8, 'script', NULL)
RETURNING id INTO r21;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'GUARD #2', 'guard #2', 6, 'script', NULL)
RETURNING id INTO r22;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'GUARD #3', 'guard #3', 4, 'script', NULL)
RETURNING id INTO r23;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'VILLAGE WOMAN', 'village woman', 7, 'script', NULL)
RETURNING id INTO r24;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'VILLAGE MAN', 'village man', 5, 'script', NULL)
RETURNING id INTO r25;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'SHADOW SOLDIER', 'shadow soldier', 12, 'script', 'Generic shadow army soldiers')
RETURNING id INTO r26;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'MESSENGER', 'messenger', 9, 'script', NULL)
RETURNING id INTO r27;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'COUNCIL MEMBER #1', 'council member #1', 11, 'script', NULL)
RETURNING id INTO r28;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'COUNCIL MEMBER #2', 'council member #2', 8, 'script', NULL)
RETURNING id INTO r29;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'COUNCIL MEMBER #3', 'council member #3', 6, 'script', NULL)
RETURNING id INTO r30;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'DRAGON VOICE', 'dragon voice', 14, 'script', 'Voice of the ancient dragon')
RETURNING id INTO r31;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'CROWD', 'crowd', 18, 'script', 'Group scenes - crowd reactions')
RETURNING id INTO r32;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'CHILD IN VILLAGE', 'child in village', 3, 'script', NULL)
RETURNING id INTO r33;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'OLD FARMER', 'old farmer', 4, 'script', NULL)
RETURNING id INTO r34;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'SHIP CAPTAIN', 'ship captain', 7, 'script', 'Appears in episodes 8-9')
RETURNING id INTO r35;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'PIRATE VOICE', 'pirate voice', 5, 'script', 'Radio communication voice')
RETURNING id INTO r36;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'KNIGHT COMMANDER', 'knight commander', 16, 'script', 'Leads the knights in battle scenes')
RETURNING id INTO r37;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, description)
VALUES (p_id, 'WITCH OF THE WOODS', 'witch of the woods', 13, 'script', 'Mysterious witch helping from the shadows')
RETURNING id INTO r38;

-- 4. Child/variant roles (same character, different casting needed)
INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, parent_role_id, description)
VALUES (p_id, 'YOUNG ROWAN', 'young rowan', 24, 'script', r03, 'Prince Rowan as a child in flashbacks')
RETURNING id INTO r03y;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, parent_role_id, description)
VALUES (p_id, 'YOUNG LIORA', 'young liora', 18, 'script', r04, 'Princess Liora as a child in flashbacks')
RETURNING id INTO r04y;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, parent_role_id, description)
VALUES (p_id, 'YOUNG ALDRIC', 'young aldric', 12, 'script', r01, 'King Aldric in flashback scenes')
RETURNING id INTO r01y;

INSERT INTO project_roles (project_id, role_name, role_name_normalized, replicas_needed, source, parent_role_id, description)
VALUES (p_id, 'MALAKAI (HUMAN FORM)', 'malakai human form', 28, 'script', r05, 'Malakai before becoming the Shadow Lord')
RETURNING id INTO r05p;

-- 5. Role conflicts (characters that share scenes = same actor cant play both)
-- Use LEAST/GREATEST to ensure role_id_a < role_id_b (role_order constraint)
INSERT INTO role_conflicts (project_id, role_id_a, role_id_b, warning_type, scene_reference)
VALUES
  (p_id, LEAST(r03, r04), GREATEST(r03, r04), 'same_scene', 'Episodes 1-13: Twins appear together in most scenes'),
  (p_id, LEAST(r01, r05), GREATEST(r01, r05), 'same_scene', 'Episodes 6, 10, 13: King confronts Shadow Lord'),
  (p_id, LEAST(r01, r02), GREATEST(r01, r02), 'same_scene', 'Episodes 1-5, 7, 12: King and Queen scenes'),
  (p_id, LEAST(r03, r06), GREATEST(r03, r06), 'same_scene', 'Episodes 2-4, 8: Prince trains with Captain'),
  (p_id, LEAST(r05, r09), GREATEST(r05, r09), 'same_scene', 'Episodes 3, 7, 11: Shadow Lord commands Grimjaw'),
  (p_id, LEAST(r07, r18), GREATEST(r07, r18), 'same_scene', 'Episodes 2, 5: Wizard and Jester comic duo'),
  (p_id, LEAST(r03, r07), GREATEST(r03, r07), 'same_scene', 'Episodes 4-6: Prince seeks Wizards help'),
  (p_id, LEAST(r08, r02), GREATEST(r08, r02), 'same_scene', 'Episodes 5, 9: Lady Seraphina attends Queens court'),
  (p_id, LEAST(r13, r06), GREATEST(r13, r06), 'same_scene', 'Episodes 7-8: General and Captain clash'),
  (p_id, LEAST(r21, r22), GREATEST(r21, r22), 'same_scene', 'Episodes 1, 3: Guards appear together at gate'),
  (p_id, LEAST(r28, r29), GREATEST(r28, r29), 'same_scene', 'Episodes 2, 6, 10: Council meetings'),
  (p_id, LEAST(r28, r30), GREATEST(r28, r30), 'same_scene', 'Episodes 2, 6, 10: Council meetings'),
  (p_id, LEAST(r29, r30), GREATEST(r29, r30), 'same_scene', 'Episodes 2, 6, 10: Council meetings');

RAISE NOTICE 'Demo project seeded successfully with 42 roles and 13 conflicts';

END $$;
