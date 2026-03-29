-- ══════════════════════════════════════════════════════════════
-- 004_auth_multiuser.sql
-- Multi-user auth: profiles table, RLS, user_id columns, backfill
-- Run in: Supabase Dashboard → SQL Editor
-- ══════════════════════════════════════════════════════════════

-- ─── PROFILES TABLE ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS profiles (
  id                   UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  email                TEXT NOT NULL,
  full_name            TEXT,
  avatar_url           TEXT,
  role                 TEXT DEFAULT 'pending'
                         CHECK (role IN ('pending', 'active', 'inactive', 'admin')),
  company              TEXT,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  created_at           TIMESTAMPTZ DEFAULT NOW(),
  last_seen_at         TIMESTAMPTZ,
  activated_at         TIMESTAMPTZ,
  activated_by         UUID
);

-- ─── AUTO-CREATE PROFILE ON SIGNUP ────────────────────────────
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN NEW.email = 'freddy.g84@gmail.com' THEN 'admin'
      ELSE 'pending'
    END
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ─── ADD user_id TO EXISTING TABLES ───────────────────────────
ALTER TABLE activities ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE activity_logs ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE recipe_scenarios ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE recipe_actuals ADD COLUMN IF NOT EXISTS
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- ─── BACKFILL EXISTING DATA TO ADMIN USER ─────────────────────
-- Assigns all existing rows to the admin account
DO $$
DECLARE
  admin_id UUID;
BEGIN
  SELECT id INTO admin_id FROM auth.users
  WHERE email = 'freddy.g84@gmail.com' LIMIT 1;

  IF admin_id IS NOT NULL THEN
    UPDATE activities      SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE activity_logs   SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE recipe_scenarios SET user_id = admin_id WHERE user_id IS NULL;
    UPDATE recipe_actuals  SET user_id = admin_id WHERE user_id IS NULL;

    -- Ensure admin profile exists and is fully set up
    INSERT INTO profiles (id, email, role, onboarding_completed)
    VALUES (admin_id, 'freddy.g84@gmail.com', 'admin', TRUE)
    ON CONFLICT (id) DO UPDATE
      SET role = 'admin', onboarding_completed = TRUE;
  END IF;
END $$;

-- ─── HELPER: is_admin() ───────────────────────────────────────
-- Using SECURITY DEFINER to avoid infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION is_admin()
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  );
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ─── ENABLE ROW LEVEL SECURITY ────────────────────────────────
ALTER TABLE profiles         ENABLE ROW LEVEL SECURITY;
ALTER TABLE activities       ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_logs    ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_scenarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE recipe_actuals   ENABLE ROW LEVEL SECURITY;

-- ─── RLS POLICIES ─────────────────────────────────────────────

-- profiles: users see own row; admins see all
DROP POLICY IF EXISTS "profiles_own" ON profiles;
CREATE POLICY "profiles_own" ON profiles
  FOR ALL USING (id = auth.uid() OR is_admin());

-- activities
DROP POLICY IF EXISTS "activities_own" ON activities;
CREATE POLICY "activities_own" ON activities
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- activity_logs
DROP POLICY IF EXISTS "activity_logs_own" ON activity_logs;
CREATE POLICY "activity_logs_own" ON activity_logs
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- recipe_scenarios
DROP POLICY IF EXISTS "recipe_scenarios_own" ON recipe_scenarios;
CREATE POLICY "recipe_scenarios_own" ON recipe_scenarios
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- recipe_actuals
DROP POLICY IF EXISTS "recipe_actuals_own" ON recipe_actuals;
CREATE POLICY "recipe_actuals_own" ON recipe_actuals
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- ══════════════════════════════════════════════════════════════
-- GOOGLE OAUTH SETUP INSTRUCTIONS
-- Complete these manually in Supabase Dashboard:
--
-- 1. Go to: Google Cloud Console → https://console.cloud.google.com
--    a. Create a new project (or use existing)
--    b. APIs & Services → OAuth consent screen
--       - User type: External
--       - App name: ProspectPro
--       - Support email: freddy.g84@gmail.com
--       - Authorized domains: add your Supabase project domain
--         (cokoraakawhrmocrwbrg.supabase.co)
--    c. APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID
--       - Application type: Web application
--       - Authorized JavaScript origins:
--           https://cokoraakawhrmocrwbrg.supabase.co
--       - Authorized redirect URIs:
--           https://cokoraakawhrmocrwbrg.supabase.co/auth/v1/callback
--    d. Copy: Client ID and Client Secret
--
-- 2. In Supabase Dashboard → Authentication → Providers → Google
--    - Enable Google provider
--    - Paste Client ID and Client Secret
--    - Save
--
-- 3. In Supabase Dashboard → Authentication → URL Configuration
--    - Site URL: http://localhost:3000 (dev) or your production URL
--    - Redirect URLs: add http://localhost:3000/auth/callback
--
-- RESEND EMAIL SETUP INSTRUCTIONS:
-- 1. Go to https://resend.com → Sign up / Log in
-- 2. Add a domain OR use resend's sandbox (onboarding@resend.dev) for testing
-- 3. API Keys → Create API Key → copy it
-- 4. Add to .env.local: RESEND_API_KEY=re_xxxxxxxxxxxx
--
-- SUPABASE SERVICE ROLE KEY:
-- Supabase Dashboard → Settings → API → service_role key (secret)
-- Add to .env.local: SUPABASE_SERVICE_ROLE_KEY=eyJ...
-- ══════════════════════════════════════════════════════════════
