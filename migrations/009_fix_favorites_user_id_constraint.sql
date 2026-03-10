-- Migration 009: Remove hardcoded user_id constraint from favorites
-- The CHECK (user_id IN ('leni', 'father')) prevents any other authenticated
-- user from using favorites. Replace with a simple NOT NULL + non-empty check.

ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_user_id_check;
ALTER TABLE favorites ADD CONSTRAINT favorites_user_id_check CHECK (user_id <> '');
