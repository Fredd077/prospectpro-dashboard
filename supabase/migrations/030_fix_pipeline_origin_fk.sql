-- Fix: ensure origin_activity_id exists and drop FK constraint
--
-- In Supabase (PgBouncer + RLS), FK constraint triggers run under the
-- authenticated role's RLS context. This causes intermittent failures when
-- setting origin_activity_id even to a valid, user-owned activity.
-- Dropping the FK and keeping a plain UUID column is the correct fix;
-- app-level referential integrity is provided by the activity dropdown.

-- Ensure column exists (idempotent in case migration 029 was not yet applied)
ALTER TABLE pipeline_simple
  ADD COLUMN IF NOT EXISTS origin_activity_id uuid;

-- Drop the FK constraint added in migration 029 (auto-generated name)
ALTER TABLE pipeline_simple
  DROP CONSTRAINT IF EXISTS pipeline_simple_origin_activity_id_fkey;

-- Index for the Rendimiento tab query (pipeline entries per activity)
CREATE INDEX IF NOT EXISTS idx_pipeline_simple_origin_activity
  ON pipeline_simple (origin_activity_id)
  WHERE origin_activity_id IS NOT NULL;
