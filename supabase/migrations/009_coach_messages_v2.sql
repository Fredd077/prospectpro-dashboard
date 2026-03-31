-- ══════════════════════════════════════════════════════════════
-- 009_coach_messages_v2.sql
-- 1. Extend coach_messages.type to include 'monthly'
-- 2. Add is_read boolean for unread badge in sidebar
-- ══════════════════════════════════════════════════════════════

-- ─── 1. Allow 'monthly' type ──────────────────────────────────
ALTER TABLE coach_messages DROP CONSTRAINT IF EXISTS coach_messages_type_check;
ALTER TABLE coach_messages
  ADD CONSTRAINT coach_messages_type_check
  CHECK (type IN ('daily', 'weekly', 'monthly'));

-- ─── 2. Unread flag ───────────────────────────────────────────
ALTER TABLE coach_messages
  ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE;
