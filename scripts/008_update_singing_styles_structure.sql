-- עדכון מבנה סגנונות שירה
-- המבנה החדש של singing_styles הוא מערך של אובייקטים במקום מערך מחרוזות

-- הסרת עמודת singing_level (כבר לא בשימוש - הרמה עכשיו לכל סגנון בנפרד)
ALTER TABLE public.actors 
DROP COLUMN IF EXISTS singing_level;

-- הסרת האינדקס הישן
DROP INDEX IF EXISTS idx_actors_singing_level;

-- עדכון תגובות
COMMENT ON COLUMN public.actors.singing_styles IS 'סגנונות שירה: [{style: "opera"|"pop"|"rock"|"jazz"|"classical"|"musical"|"folk"|"other", level: "basic"|"medium"|"high"}]';
COMMENT ON COLUMN public.actors.singing_styles_other IS 'סגנונות שירה נוספים (אחר): [{name: string, level: "basic"|"medium"|"high"}]';

-- אם יש נתונים קיימים בפורמט הישן (מערך מחרוזות), אפשר להמיר אותם
-- הקוד הזה ימיר מערך כמו ["opera", "jazz"] למערך כמו [{style: "opera", level: "basic"}, {style: "jazz", level: "basic"}]
UPDATE public.actors 
SET singing_styles = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object('style', elem::text, 'level', 'basic')
    ),
    '[]'::jsonb
  )
  FROM jsonb_array_elements_text(singing_styles) AS elem
  WHERE jsonb_typeof(elem::jsonb) = 'string'
)
WHERE jsonb_typeof(singing_styles) = 'array' 
  AND jsonb_array_length(singing_styles) > 0
  AND jsonb_typeof(singing_styles->0) = 'string';
