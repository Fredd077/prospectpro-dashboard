-- ══════════════════════════════════════════════════════════════
-- 010_fix_admin_rls.sql
-- 1. Remove OR is_admin() from personal data table RLS policies.
--    Admin access to cross-user data is ONLY via service_role client
--    (used in /admin and /team pages). The anon client (used in all
--    personal pages: dashboard, checkin, recipe, activities, coach)
--    now correctly scopes to auth.uid() only.
-- 2. Update handle_new_user trigger to capture company from signup metadata.
-- ══════════════════════════════════════════════════════════════

-- ─── activities ───────────────────────────────────────────────
DROP POLICY IF EXISTS "activities_own" ON activities;
CREATE POLICY "activities_own" ON activities
  FOR ALL USING (user_id = auth.uid());

-- ─── activity_logs ────────────────────────────────────────────
DROP POLICY IF EXISTS "activity_logs_own" ON activity_logs;
CREATE POLICY "activity_logs_own" ON activity_logs
  FOR ALL USING (user_id = auth.uid());

-- ─── recipe_scenarios ─────────────────────────────────────────
DROP POLICY IF EXISTS "recipe_scenarios_own" ON recipe_scenarios;
CREATE POLICY "recipe_scenarios_own" ON recipe_scenarios
  FOR ALL USING (user_id = auth.uid());

-- ─── recipe_actuals ───────────────────────────────────────────
DROP POLICY IF EXISTS "recipe_actuals_own" ON recipe_actuals;
CREATE POLICY "recipe_actuals_own" ON recipe_actuals
  FOR ALL USING (user_id = auth.uid());

-- ─── coach_messages ───────────────────────────────────────────
DROP POLICY IF EXISTS "coach_messages_own" ON coach_messages;
CREATE POLICY "coach_messages_own" ON coach_messages
  FOR ALL USING (user_id = auth.uid());

-- ─── profiles: keep is_admin() so admin panel can read profiles ─
-- (no change needed — profiles policy already correct for admin use
--  since UsersTable uses service_role client)

-- ─── Update trigger to save company from signup metadata ──────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, role, company)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name'),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE WHEN NEW.email = 'freddy.g84@gmail.com' THEN 'admin' ELSE 'pending' END,
    NULLIF(TRIM(NEW.raw_user_meta_data->>'company'), '')
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
