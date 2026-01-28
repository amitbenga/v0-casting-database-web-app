-- הוספת שדות ניסיון בדיבוב ושירה לטבלת השחקנים

-- שדה ניסיון בדיבוב (בשנים) - שדה מספרי
ALTER TABLE public.actors 
ADD COLUMN IF NOT EXISTS dubbing_experience_years INTEGER DEFAULT 0;

-- רמת שירה - בחירה אחת מרשימה סגורה
-- ערכים: basic (בסיסית), good (טובה), high (גבוהה), null (לא רלוונטי)
ALTER TABLE public.actors 
ADD COLUMN IF NOT EXISTS singing_level TEXT CHECK (singing_level IS NULL OR singing_level IN ('basic', 'good', 'high'));

-- סגנונות שירה - מערך של סגנונות
-- ערכים אפשריים: musical, classic, pop, opera, jazz, rock
ALTER TABLE public.actors 
ADD COLUMN IF NOT EXISTS singing_styles JSONB DEFAULT '[]'::jsonb;

-- סגנון שירה אחר - טקסט חופשי עם רמה
-- פורמט: [{"name": "שם הסגנון", "level": "basic/good/high"}, ...]
ALTER TABLE public.actors 
ADD COLUMN IF NOT EXISTS singing_styles_other JSONB DEFAULT '[]'::jsonb;

-- אינדקס לסינון לפי ניסיון בדיבוב
CREATE INDEX IF NOT EXISTS idx_actors_dubbing_experience ON public.actors(dubbing_experience_years);

-- אינדקס לסינון לפי רמת שירה
CREATE INDEX IF NOT EXISTS idx_actors_singing_level ON public.actors(singing_level);

COMMENT ON COLUMN public.actors.dubbing_experience_years IS 'ניסיון בדיבוב בשנים';
COMMENT ON COLUMN public.actors.singing_level IS 'רמת שירה: basic=בסיסית, good=טובה, high=גבוהה';
COMMENT ON COLUMN public.actors.singing_styles IS 'סגנונות שירה: musical, classic, pop, opera, jazz, rock';
COMMENT ON COLUMN public.actors.singing_styles_other IS 'סגנונות שירה נוספים עם רמה';
