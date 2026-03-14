-- Migration 011: Add editable sort_index to script_lines
--
-- Purpose:
--   Separate source/display numbering (`line_number`) from editable row order.
--   This enables insert-above, insert-below, duplicate, and future reorder flows
--   without relying on line_number as the only ordering field.

ALTER TABLE script_lines
  ADD COLUMN IF NOT EXISTS sort_index INTEGER;

WITH ordered AS (
  SELECT
    id,
    ROW_NUMBER() OVER (
      PARTITION BY project_id
      ORDER BY line_number NULLS LAST, created_at, id
    ) AS row_num
  FROM script_lines
)
UPDATE script_lines sl
SET sort_index = ordered.row_num * 1024
FROM ordered
WHERE sl.id = ordered.id
  AND sl.sort_index IS NULL;

ALTER TABLE script_lines
  ALTER COLUMN sort_index SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_script_lines_project_sort_index
  ON script_lines (project_id, sort_index);

COMMENT ON COLUMN script_lines.sort_index IS
  'Editable workspace ordering key. line_number remains display/source metadata.';
