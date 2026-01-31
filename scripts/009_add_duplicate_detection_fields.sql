-- Migration: Add duplicate detection fields to actor_submissions
-- This adds normalized email/phone for duplicate detection and tracking fields

-- Add normalized fields for duplicate detection
ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS normalized_email TEXT;

ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS normalized_phone TEXT;

-- Add match tracking fields
ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS match_status TEXT DEFAULT 'pending';

ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS matched_actor_id UUID REFERENCES actors(id);

ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS merge_report JSONB;

-- Add raw payload to store original form data
ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS raw_payload JSONB;

-- Add "other" fields for skills and languages
ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS skills_other TEXT;

ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS languages_other TEXT;

-- Rename status to review_status if it exists (for compatibility)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'actor_submissions' AND column_name = 'status'
  ) THEN
    -- Check if review_status doesn't already exist
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_name = 'actor_submissions' AND column_name = 'review_status'
    ) THEN
      ALTER TABLE actor_submissions RENAME COLUMN status TO review_status;
    ELSE
      -- If both exist, drop the old status column
      ALTER TABLE actor_submissions DROP COLUMN status;
    END IF;
  END IF;
END $$;

-- Add review_status if it doesn't exist
ALTER TABLE actor_submissions 
ADD COLUMN IF NOT EXISTS review_status TEXT DEFAULT 'pending';

-- Create indexes for faster duplicate lookups
CREATE INDEX IF NOT EXISTS idx_actor_submissions_normalized_email 
ON actor_submissions(normalized_email) WHERE normalized_email IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_actor_submissions_normalized_phone 
ON actor_submissions(normalized_phone) WHERE normalized_phone IS NOT NULL;

-- Update existing records to populate normalized fields
UPDATE actor_submissions 
SET normalized_email = LOWER(TRIM(email))
WHERE email IS NOT NULL AND normalized_email IS NULL;

UPDATE actor_submissions 
SET normalized_phone = REGEXP_REPLACE(phone, '\D', '', 'g')
WHERE phone IS NOT NULL AND normalized_phone IS NULL;

-- Add comments
COMMENT ON COLUMN actor_submissions.normalized_email IS 'Lowercase, trimmed email for duplicate detection';
COMMENT ON COLUMN actor_submissions.normalized_phone IS 'Digits only phone for duplicate detection';
COMMENT ON COLUMN actor_submissions.match_status IS 'Status of duplicate matching: pending, matched, no_match';
COMMENT ON COLUMN actor_submissions.matched_actor_id IS 'Reference to matched existing actor if found';
COMMENT ON COLUMN actor_submissions.merge_report IS 'JSON report of merge decisions when matched';
COMMENT ON COLUMN actor_submissions.raw_payload IS 'Original form data as submitted';
COMMENT ON COLUMN actor_submissions.skills_other IS 'Free text for other skills not in predefined list';
COMMENT ON COLUMN actor_submissions.languages_other IS 'Free text for other languages not in predefined list';
