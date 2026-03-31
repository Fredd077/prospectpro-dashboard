-- ══════════════════════════════════════════════════════════════
-- 011_fix_null_user_ids.sql
--
-- Root cause of Bugs 1 & 2 (admin lost personal data):
--   Migration 010 changed policies to: user_id = auth.uid()
--   Rows where user_id IS NULL are now invisible to everyone
--   (NULL = auth.uid() evaluates to NULL, not TRUE).
--   Previously OR is_admin() masked this — admin could see all
--   rows including NULL-user_id rows.
--
-- Fix: backfill any NULL user_ids to the admin account.
-- The RLS policies from 010 are correct — no policy changes needed.
-- ══════════════════════════════════════════════════════════════

-- ─── Step 1: Diagnose — counts before fix ─────────────────────
DO $$
DECLARE
  n_act INTEGER; n_log INTEGER; n_rec INTEGER;
  n_ra  INTEGER; n_cm  INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_act FROM activities       WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_log FROM activity_logs    WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_rec FROM recipe_scenarios WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_ra  FROM recipe_actuals   WHERE user_id IS NULL;
  SELECT COUNT(*) INTO n_cm  FROM coach_messages   WHERE user_id IS NULL;
  RAISE NOTICE 'NULL user_ids before fix — activities: %, logs: %, scenarios: %, actuals: %, coach: %',
    n_act, n_log, n_rec, n_ra, n_cm;
END $$;

-- ─── Step 2: Backfill NULLs to admin ─────────────────────────
DO $$
DECLARE
  admin_id UUID;
  n_act INTEGER; n_log INTEGER; n_rec INTEGER;
  n_ra  INTEGER; n_cm  INTEGER;
BEGIN
  SELECT id INTO admin_id FROM auth.users
  WHERE email = 'freddy.g84@gmail.com' LIMIT 1;

  IF admin_id IS NULL THEN
    RAISE EXCEPTION 'Admin user not found — verify email is correct in auth.users';
  END IF;

  UPDATE activities       SET user_id = admin_id WHERE user_id IS NULL;
  GET DIAGNOSTICS n_act = ROW_COUNT;

  UPDATE activity_logs    SET user_id = admin_id WHERE user_id IS NULL;
  GET DIAGNOSTICS n_log = ROW_COUNT;

  UPDATE recipe_scenarios SET user_id = admin_id WHERE user_id IS NULL;
  GET DIAGNOSTICS n_rec = ROW_COUNT;

  UPDATE recipe_actuals   SET user_id = admin_id WHERE user_id IS NULL;
  GET DIAGNOSTICS n_ra  = ROW_COUNT;

  UPDATE coach_messages   SET user_id = admin_id WHERE user_id IS NULL;
  GET DIAGNOSTICS n_cm  = ROW_COUNT;

  RAISE NOTICE 'Backfill complete (admin_id: %) — fixed rows: activities=%, logs=%, scenarios=%, actuals=%, coach=%',
    admin_id, n_act, n_log, n_rec, n_ra, n_cm;
END $$;

-- ─── Step 3: Prevent future NULLs ────────────────────────────
-- Add DEFAULT auth.uid() on tables that don't have it.
-- Server-side inserts that omit user_id will use the session user.
ALTER TABLE activities
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE activity_logs
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE recipe_scenarios
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE recipe_actuals
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- coach_messages already has DEFAULT auth.uid() from migration 008
