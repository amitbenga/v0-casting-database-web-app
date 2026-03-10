-- Migration 010: Ensure folders table has color, description, and updated_at columns
-- The 004_update_schema.sql script recreated folders without these columns,
-- but application code (folder-actions.ts, create-folder-dialog.tsx) writes to them.
-- This migration adds the missing columns if they don't exist.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folders' AND column_name = 'color'
  ) THEN
    ALTER TABLE public.folders ADD COLUMN color TEXT DEFAULT 'blue';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folders' AND column_name = 'description'
  ) THEN
    ALTER TABLE public.folders ADD COLUMN description TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'folders' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE public.folders ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();
  END IF;
END $$;
