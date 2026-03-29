-- ══════════════════════════════════════════════════════════════
-- 007_fix_defaults_and_channel.sql
-- 1. Set DEFAULT auth.uid() on user_id columns so browser-client
--    INSERTs that omit user_id are auto-attributed to the auth user
--    (fixes "Error al guardar" when creating activities/logs from
--    the browser Supabase client without explicitly passing user_id).
-- 2. Drop any CHECK constraint on activities.channel so any free
--    text value is accepted (needed for the custom-channel combobox).
-- ══════════════════════════════════════════════════════════════

-- ─── 1. user_id defaults ──────────────────────────────────────
ALTER TABLE activities      ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE activity_logs   ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE recipe_scenarios ALTER COLUMN user_id SET DEFAULT auth.uid();
ALTER TABLE recipe_actuals   ALTER COLUMN user_id SET DEFAULT auth.uid();

-- ─── 2. Drop any CHECK constraint on activities.channel ───────
-- This handles constraints added manually in Supabase Studio
-- that are not reflected in migration files.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT conname
    FROM   pg_constraint
    WHERE  conrelid = 'public.activities'::regclass
      AND  contype  = 'c'
      AND  pg_get_constraintdef(oid) ILIKE '%channel%'
  LOOP
    EXECUTE format('ALTER TABLE activities DROP CONSTRAINT IF EXISTS %I', r.conname);
    RAISE LOG 'Dropped constraint % from activities', r.conname;
  END LOOP;
END $$;
