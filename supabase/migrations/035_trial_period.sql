-- 035_trial_period.sql
-- Adds 14-day trial period tracking to profiles

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS trial_ends_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS trial_reminder_7d     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_reminder_3d     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_reminder_1d     BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS trial_expired_email   BOOLEAN NOT NULL DEFAULT FALSE;

-- Index for the cron job to quickly find users whose trial is expiring
CREATE INDEX IF NOT EXISTS idx_profiles_trial_ends_at
  ON profiles (trial_ends_at)
  WHERE trial_ends_at IS NOT NULL;
