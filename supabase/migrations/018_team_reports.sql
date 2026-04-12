-- ══════════════════════════════════════════════════════════════
-- 018_team_reports.sql
-- Adds team report metadata columns to coach_messages.
-- Non-destructive — no existing columns modified.
-- ══════════════════════════════════════════════════════════════

-- ─── 1. Extend type check to include 'team_report' ────────────
ALTER TABLE coach_messages DROP CONSTRAINT IF EXISTS coach_messages_type_check;
ALTER TABLE coach_messages
  ADD CONSTRAINT coach_messages_type_check
  CHECK (type IN ('daily', 'weekly', 'monthly', 'team_report'));

-- ─── 2. New metadata columns ──────────────────────────────────
ALTER TABLE coach_messages
  ADD COLUMN IF NOT EXISTS triggered_by  TEXT DEFAULT 'auto',
  ADD COLUMN IF NOT EXISTS report_scope  TEXT DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS sent_to_email TEXT;
