-- ══════════════════════════════════════════════════════════════
-- 005_fix_auth_trigger.sql
-- Fixes: handle_new_user trigger causing unexpected_failure on OAuth
--
-- Root causes fixed:
--   1. No EXCEPTION handler → trigger failure blocks the entire OAuth flow
--   2. Missing SET search_path = public → SECURITY DEFINER can't find table
--   3. email NOT NULL with no fallback → edge-case crash on some OAuth providers
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url, role)
  VALUES (
    NEW.id,
    -- Google OAuth always sets email, but be defensive
    COALESCE(NEW.email, NEW.raw_user_meta_data->>'email', 'unknown@placeholder.com'),
    COALESCE(
      NEW.raw_user_meta_data->>'full_name',
      NEW.raw_user_meta_data->>'name'
    ),
    NEW.raw_user_meta_data->>'avatar_url',
    CASE
      WHEN COALESCE(NEW.email, NEW.raw_user_meta_data->>'email') = 'freddy.g84@gmail.com'
        THEN 'admin'
      ELSE 'pending'
    END
  )
  ON CONFLICT (id) DO NOTHING;

  RETURN NEW;

EXCEPTION WHEN OTHERS THEN
  -- Never block auth flow due to profile creation errors.
  -- Error is logged to Supabase logs (Dashboard → Logs → Postgres).
  RAISE LOG 'handle_new_user() failed for user %: % %', NEW.id, SQLSTATE, SQLERRM;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql
   SECURITY DEFINER
   SET search_path = public;

-- Re-attach trigger (idempotent)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
