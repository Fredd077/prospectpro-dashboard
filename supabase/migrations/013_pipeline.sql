-- ─── Mi Pipeline: commercial funnel stage tracking ────────────────────────────
-- Stages are dynamic from recipe_scenarios.funnel_stages (never hardcoded here).
-- First stage "Actividad" is excluded — it is tracked via activity_logs.
-- Only stages 2 through N are stored here.

CREATE TABLE pipeline_entries (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID         NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_scenario_id UUID         REFERENCES recipe_scenarios(id) ON DELETE SET NULL,
  stage              TEXT         NOT NULL,
  company_name       TEXT         NOT NULL,
  prospect_name      TEXT         NOT NULL,
  quantity           INTEGER      NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  amount_usd         NUMERIC(12,2),
  entry_date         DATE         NOT NULL DEFAULT CURRENT_DATE,
  notes              TEXT,
  created_at         TIMESTAMPTZ  DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  DEFAULT NOW()
);

-- Row level security
ALTER TABLE pipeline_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pipeline_own" ON pipeline_entries
  FOR ALL USING (user_id = auth.uid() OR is_admin());

-- Performance indexes
CREATE INDEX pipeline_entries_user_date
  ON pipeline_entries(user_id, entry_date DESC);

CREATE INDEX pipeline_entries_stage
  ON pipeline_entries(user_id, stage, entry_date DESC);

-- Auto-update updated_at
CREATE TRIGGER pipeline_entries_updated_at
  BEFORE UPDATE ON pipeline_entries
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
