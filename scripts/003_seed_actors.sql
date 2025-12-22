-- הזנת 10 השחקנים שהעלית
INSERT INTO public.actors (full_name, gender, birth_year, phone, email, notes, is_singer, is_course_graduate, vat_status, skills, languages) VALUES
('נועם כהן', 'זכר', 1995, '050-1234567', 'noam@example.com', '', true, true, 'עוסק מורשה', ARRAY['קרב', 'ריקוד', 'דרמה'], ARRAY['עברית', 'אנגלית']),
('תמר לוי', 'נקבה', 1998, '052-2345678', 'tamar@example.com', '', true, false, 'עוסק פטור', ARRAY['שירה', 'ריקוד'], ARRAY['עברית', 'אנגלית', 'צרפתית']),
('יונתן מזרחי', 'זכר', 1992, '054-3456789', 'yonatan@example.com', '', false, true, 'לא עוסק', ARRAY['קומדיה', 'דרמה'], ARRAY['עברית', 'רוסית']),
('שירה אברהם', 'נקבה', 2000, '050-4567890', 'shira@example.com', '', true, true, 'עוסק מורשה', ARRAY['שירה', 'מוזיקה'], ARRAY['עברית']),
('דניאל גולן', 'זכר', 1988, '052-5678901', 'daniel@example.com', '', false, false, 'עוסק פטור', ARRAY['קרב', 'ספורט'], ARRAY['עברית', 'אנגלית']),
('מיכל שפירא', 'נקבה', 1996, '054-6789012', 'michal@example.com', '', true, true, 'עוסק מורשה', ARRAY['דרמה', 'ריקוד', 'שירה'], ARRAY['עברית', 'אנגלית', 'ספרדית']),
('עומר דהן', 'זכר', 1993, '050-7890123', 'omer@example.com', '', false, true, 'לא עוסק', ARRAY['קומדיה'], ARRAY['עברית', 'ערבית']),
('רונית ברק', 'נקבה', 1999, '052-8901234', 'ronit@example.com', '', true, false, 'עוסק פטור', ARRAY['שירה', 'מוזיקה', 'דרמה'], ARRAY['עברית', 'אנגלית']),
('אייל מור', 'זכר', 1991, '054-9012345', 'eyal@example.com', '', false, true, 'עוסק מורשה', ARRAY['קרב', 'ספורט', 'דרמה'], ARRAY['עברית']),
('ליאת חזן', 'נקבה', 1997, '050-0123456', 'liat@example.com', '', true, true, 'לא עוסק', ARRAY['ריקוד', 'שירה'], ARRAY['עברית', 'אנגלית', 'איטלקית']);
