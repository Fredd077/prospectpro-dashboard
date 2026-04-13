-- ══════════════════════════════════════════════════════════════
-- 019_fix_view_security.sql
--
-- SECURITY BUG: vw_daily_compliance was a SECURITY DEFINER view
-- (PostgreSQL default). This caused the view to execute as the
-- view owner (postgres/superuser), bypassing RLS on activity_logs
-- and activities entirely — ALL users' data was visible to any
-- authenticated user querying the view.
--
-- Fix:
-- 1. Recreate the view with security_invoker = true so it runs
--    with the calling role's permissions and RLS is enforced.
-- 2. Add al.user_id to the SELECT so callers can add an explicit
--    .eq('user_id', uid) filter as a second layer of defence.
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE VIEW vw_daily_compliance
WITH (security_invoker = true)
AS
SELECT
  al.id,
  al.user_id,
  al.log_date,
  a.type,
  a.channel,
  a.id          AS activity_id,
  a.name        AS activity_name,
  al.day_goal,
  al.real_executed,
  al.notes,
  al.is_retroactive,
  CASE
    WHEN al.day_goal = 0 THEN NULL
    ELSE ROUND((al.real_executed::NUMERIC / al.day_goal) * 100, 2)
  END           AS compliance_pct,
  CASE
    WHEN al.day_goal = 0 THEN 'no_goal'
    WHEN al.real_executed >= al.day_goal THEN 'green'
    WHEN (al.real_executed::NUMERIC / al.day_goal) >= 0.7 THEN 'yellow'
    ELSE 'red'
  END           AS semaphore
FROM activity_logs al
JOIN activities a ON a.id = al.activity_id;
