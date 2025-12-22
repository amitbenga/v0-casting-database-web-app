-- הזנת 10 השחקנים האמיתיים שהעלית
INSERT INTO public.actors (full_name, gender, birth_year, phone, email, is_singer, is_course_grad, vat_status, notes, city, skills, languages, other_lang_text) VALUES
('מיכה אוזין סליאן', 'male', 1963, '052-827-2740', '', true, false, 'ptor', '', 'פתח תקווה', 
  '[{"id":"2","key":"singing","label":"שירה"},{"id":"1","key":"acting","label":"משחק"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"}]'::jsonb, ''),

('אלון נוימן', 'male', 1967, '054-442-8999', '', true, false, 'ptor', '', 'תל אביב',
  '[{"id":"2","key":"singing","label":"שירה"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"},{"id":"5","key":"french","label":"צרפתית"}]'::jsonb, ''),

('שאול עזר', 'male', 1970, '052-290-3078', '', false, false, 'ptor', '', 'פתח תקווה',
  '[{"id":"1","key":"acting","label":"משחק"},{"id":"6","key":"any_accent","label":"כל מבטא אפשרי"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"},{"id":"4","key":"arabic","label":"ערבית"}]'::jsonb, 
  'אנגלית – בינוני, ערבית – בינוני'),

('רובי מוסקוביץ', 'male', 1971, '050-234-4006', '', true, false, 'ptor', '', 'ניר צבי',
  '[{"id":"2","key":"singing","label":"שירה"},{"id":"1","key":"acting","label":"משחק"},{"id":"4","key":"carpentry","label":"נגרות"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"},{"id":"4","key":"arabic","label":"ערבית"}]'::jsonb,
  'ערבית (שפת אם)'),

('אמנון וולף', 'male', 1972, '054-444-9194', '', false, false, 'ptor', '', 'פרדס חנה',
  '[{"id":"1","key":"acting","label":"משחק"},{"id":"5","key":"russian_accent","label":"מבטא רוסי"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"}]'::jsonb, ''),

('נתן דטנר', 'male', 1956, '052-355-5585', '', false, false, 'ptor', '', 'תל אביב',
  '[{"id":"1","key":"acting","label":"משחק"},{"id":"3","key":"voice_acting","label":"קריינות"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"}]'::jsonb, ''),

('שלומי נטל', 'male', 1975, '054-771-2442', '', true, false, 'ptor', '', 'ראשון לציון',
  '[{"id":"1","key":"acting","label":"משחק"},{"id":"2","key":"singing","label":"שירה"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"}]'::jsonb, ''),

('שרון כהן', 'female', 1980, '054-123-4567', '', false, false, 'ptor', '', 'רמת גן',
  '[{"id":"1","key":"acting","label":"משחק"},{"id":"3","key":"voice_acting","label":"קריינות"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"}]'::jsonb, ''),

('גלית גיאת', 'female', 1971, '050-333-8899', '', true, false, 'ptor', '', 'תל אביב',
  '[{"id":"2","key":"singing","label":"שירה"},{"id":"1","key":"acting","label":"משחק"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"}]'::jsonb, ''),

('ענת וקסמן', 'female', 1961, '052-777-4411', '', false, false, 'ptor', '', 'תל אביב',
  '[{"id":"1","key":"acting","label":"משחק"},{"id":"3","key":"voice_acting","label":"קריינות"}]'::jsonb,
  '[{"id":"2","key":"english","label":"אנגלית"}]'::jsonb, '');
