-- Add meetings_expected to activities
-- Stores the expected number of meetings per month per activity.
-- Used in the Rendimiento tab to calculate Eficiencia Canal %.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS meetings_expected INTEGER DEFAULT 0;
