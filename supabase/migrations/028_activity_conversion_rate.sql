-- Add conversion_rate_pct to activities
-- Represents estimated % of times executing this activity results in booking a cita.
-- Example: 12 means 12 out of 100 executions yield an appointment.

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS conversion_rate_pct NUMERIC(5,2) DEFAULT NULL
  CONSTRAINT activities_conversion_rate_pct_check
    CHECK (conversion_rate_pct IS NULL OR (conversion_rate_pct >= 0 AND conversion_rate_pct <= 100));
