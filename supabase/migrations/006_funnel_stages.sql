-- ══════════════════════════════════════════════════════════════
-- 006_funnel_stages.sql
-- Customizable funnel stages for recipe_scenarios
--
-- Changes:
--   + funnel_stages JSONB  → ordered array of stage names
--   + outbound_rates JSONB → conversion rates per transition (outbound)
--   + inbound_rates JSONB  → conversion rates per transition (inbound)
--   - Removes 8 individual conv_* columns (replaced by JSONB arrays)
--   - Removes 4 fixed-label intermediate totals (closes/proposals/meetings/speeches)
--     These column names are meaningless with dynamic stages.
--     activities_needed_monthly/weekly/daily remain (first stage = "Actividad" always).
-- ══════════════════════════════════════════════════════════════

-- ─── STEP 1: Add new JSONB columns ───────────────────────────
ALTER TABLE recipe_scenarios
  ADD COLUMN IF NOT EXISTS funnel_stages JSONB,
  ADD COLUMN IF NOT EXISTS outbound_rates JSONB,
  ADD COLUMN IF NOT EXISTS inbound_rates JSONB;

-- ─── STEP 2: Backfill from existing individual conv columns ──
-- Maps the 4 outbound and 4 inbound rates to JSON arrays.
-- Uses COALESCE to handle NULLs gracefully.
UPDATE recipe_scenarios SET
  funnel_stages = '["Actividad","Discurso","Reunión","Propuesta","Cierre"]'::jsonb,
  outbound_rates = jsonb_build_array(
    COALESCE(conv_activity_to_speech,  80),
    COALESCE(conv_speech_to_meeting,   10),
    COALESCE(conv_meeting_to_proposal, 50),
    COALESCE(conv_proposal_to_close,   30)
  ),
  inbound_rates = jsonb_build_array(
    COALESCE(inbound_conv_activity_to_speech,  100),
    COALESCE(inbound_conv_speech_to_meeting,   100),
    COALESCE(inbound_conv_meeting_to_proposal,  50),
    COALESCE(inbound_conv_proposal_to_close,    30)
  );

-- ─── STEP 3: Apply defaults + NOT NULL after backfill ────────
ALTER TABLE recipe_scenarios
  ALTER COLUMN funnel_stages SET NOT NULL,
  ALTER COLUMN funnel_stages SET DEFAULT
    '["Actividad","Discurso","Reunión","Propuesta","Cierre"]'::jsonb,
  ALTER COLUMN outbound_rates SET NOT NULL,
  ALTER COLUMN outbound_rates SET DEFAULT '[80,10,50,30]'::jsonb,
  ALTER COLUMN inbound_rates SET NOT NULL,
  ALTER COLUMN inbound_rates SET DEFAULT '[100,100,50,30]'::jsonb;

-- ─── STEP 4: Drop old individual conv columns ────────────────
ALTER TABLE recipe_scenarios
  DROP COLUMN IF EXISTS conv_activity_to_speech,
  DROP COLUMN IF EXISTS conv_speech_to_meeting,
  DROP COLUMN IF EXISTS conv_meeting_to_proposal,
  DROP COLUMN IF EXISTS conv_proposal_to_close,
  DROP COLUMN IF EXISTS inbound_conv_activity_to_speech,
  DROP COLUMN IF EXISTS inbound_conv_speech_to_meeting,
  DROP COLUMN IF EXISTS inbound_conv_meeting_to_proposal,
  DROP COLUMN IF EXISTS inbound_conv_proposal_to_close;

-- ─── STEP 5: Drop fixed-label intermediate totals ────────────
ALTER TABLE recipe_scenarios
  DROP COLUMN IF EXISTS closes_needed_monthly,
  DROP COLUMN IF EXISTS proposals_needed_monthly,
  DROP COLUMN IF EXISTS meetings_needed_monthly,
  DROP COLUMN IF EXISTS speeches_needed_monthly;

-- ─── RESULT SCHEMA ───────────────────────────────────────────
-- recipe_scenarios now has:
--   funnel_stages        JSONB  ["Actividad","Discurso","Reunión","Propuesta","Cierre"]
--   outbound_rates       JSONB  [80, 10, 50, 30]   (length = funnel_stages.length - 1)
--   inbound_rates        JSONB  [100, 100, 50, 30]
--   activities_needed_monthly  NUMERIC  (first stage total, outbound + inbound)
--   activities_needed_weekly   NUMERIC
--   activities_needed_daily    NUMERIC
