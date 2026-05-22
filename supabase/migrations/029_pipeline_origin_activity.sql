-- Add origin_activity_id to pipeline_simple
-- Tracks which prospecting activity generated each meeting/cita

ALTER TABLE pipeline_simple
  ADD COLUMN IF NOT EXISTS origin_activity_id uuid REFERENCES activities(id) ON DELETE SET NULL;
