-- ══════════════════════════════════════════════════════════════
-- 008_coach_messages.sql
-- AI coach message cache. One row per user per day (daily) or
-- per week (weekly, keyed on Monday's date). Prevents re-calling
-- Claude for the same period.
-- ══════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS coach_messages (
  id           UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id      UUID        REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  type         TEXT        NOT NULL CHECK (type IN ('daily', 'weekly')),
  message      TEXT        NOT NULL,
  context      JSONB,
  period_date  DATE        NOT NULL,
  user_comment TEXT,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Unique: one message per user per type per period
CREATE UNIQUE INDEX IF NOT EXISTS coach_messages_user_type_period
  ON coach_messages (user_id, type, period_date);

-- RLS
ALTER TABLE coach_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coach_messages_own" ON coach_messages
  FOR ALL USING (user_id = auth.uid() OR is_admin());
