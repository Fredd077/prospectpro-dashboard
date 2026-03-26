-- ProspectPro Dashboard — Supabase Migration
-- Run in this order in Supabase SQL Editor

-- ─────────────────────────────────────────────────────────────────
-- 1. activities
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activities (
  id            UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT          NOT NULL,
  type          TEXT          NOT NULL CHECK (type IN ('OUTBOUND', 'INBOUND')),
  channel       TEXT          NOT NULL,
  daily_goal    INTEGER       NOT NULL DEFAULT 0 CHECK (daily_goal >= 0),
  weekly_goal   INTEGER       NOT NULL DEFAULT 0 CHECK (weekly_goal >= 0),
  monthly_goal  INTEGER       NOT NULL DEFAULT 0 CHECK (monthly_goal >= 0),
  status        TEXT          NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'inactive')),
  sort_order    INTEGER       NOT NULL DEFAULT 0,
  description   TEXT,
  created_at    TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_activities_type    ON activities(type);
CREATE INDEX IF NOT EXISTS idx_activities_status  ON activities(status);
CREATE INDEX IF NOT EXISTS idx_activities_channel ON activities(channel);

-- ─────────────────────────────────────────────────────────────────
-- 2. goals (activity_id nullable = aggregate goal)
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS goals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID        REFERENCES activities(id) ON DELETE CASCADE,
  period_type     TEXT        NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly', 'quarterly')),
  period_start    DATE        NOT NULL,
  period_end      DATE        NOT NULL,
  target_value    INTEGER     NOT NULL CHECK (target_value >= 0),
  label           TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_goals_activity_period UNIQUE (activity_id, period_type, period_start),
  CONSTRAINT chk_goals_dates CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_goals_activity_id   ON goals(activity_id);
CREATE INDEX IF NOT EXISTS idx_goals_period_start  ON goals(period_start);
CREATE INDEX IF NOT EXISTS idx_goals_period_range  ON goals(period_start, period_end);

-- ─────────────────────────────────────────────────────────────────
-- 3. activity_logs
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS activity_logs (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  activity_id     UUID        NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  log_date        DATE        NOT NULL,
  day_goal        INTEGER     NOT NULL DEFAULT 0 CHECK (day_goal >= 0),
  real_executed   INTEGER     NOT NULL DEFAULT 0 CHECK (real_executed >= 0),
  notes           TEXT,
  is_retroactive  BOOLEAN     NOT NULL DEFAULT false,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_activity_logs_activity_date UNIQUE (activity_id, log_date)
);

CREATE INDEX IF NOT EXISTS idx_logs_activity_id ON activity_logs(activity_id);
CREATE INDEX IF NOT EXISTS idx_logs_log_date    ON activity_logs(log_date);
CREATE INDEX IF NOT EXISTS idx_logs_date_range  ON activity_logs(log_date, activity_id);

-- ─────────────────────────────────────────────────────────────────
-- 4. recipe_scenarios
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_scenarios (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                      TEXT          NOT NULL,
  description               TEXT,
  is_active                 BOOLEAN       NOT NULL DEFAULT true,
  monthly_revenue_goal      NUMERIC(12,2) NOT NULL CHECK (monthly_revenue_goal > 0),
  outbound_pct              NUMERIC(5,2)  NOT NULL DEFAULT 50.00
                              CHECK (outbound_pct BETWEEN 0 AND 100),
  inbound_pct               NUMERIC(5,2)  NOT NULL
                              GENERATED ALWAYS AS (100 - outbound_pct) STORED,
  average_ticket            NUMERIC(12,2) NOT NULL CHECK (average_ticket > 0),
  working_days_per_month    INTEGER       NOT NULL DEFAULT 22
                              CHECK (working_days_per_month BETWEEN 1 AND 31),
  conv_activity_to_speech   NUMERIC(5,2)  NOT NULL CHECK (conv_activity_to_speech BETWEEN 0.01 AND 100),
  conv_speech_to_meeting    NUMERIC(5,2)  NOT NULL CHECK (conv_speech_to_meeting BETWEEN 0.01 AND 100),
  conv_meeting_to_proposal  NUMERIC(5,2)  NOT NULL CHECK (conv_meeting_to_proposal BETWEEN 0.01 AND 100),
  conv_proposal_to_close    NUMERIC(5,2)  NOT NULL CHECK (conv_proposal_to_close BETWEEN 0.01 AND 100),
  closes_needed_monthly     NUMERIC(8,2),
  proposals_needed_monthly  NUMERIC(8,2),
  meetings_needed_monthly   NUMERIC(8,2),
  speeches_needed_monthly   NUMERIC(8,2),
  activities_needed_monthly NUMERIC(8,2),
  activities_needed_weekly  NUMERIC(8,2),
  activities_needed_daily   NUMERIC(8,2),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at                TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_recipe_scenarios_active ON recipe_scenarios(is_active);

-- ─────────────────────────────────────────────────────────────────
-- 5. recipe_actuals
-- ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS recipe_actuals (
  id                      UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  scenario_id             UUID        NOT NULL REFERENCES recipe_scenarios(id) ON DELETE CASCADE,
  period_start            DATE        NOT NULL,
  period_end              DATE        NOT NULL,
  period_type             TEXT        NOT NULL CHECK (period_type IN ('weekly', 'monthly', 'quarterly')),
  actual_activities       INTEGER     NOT NULL DEFAULT 0 CHECK (actual_activities >= 0),
  actual_speeches         INTEGER     NOT NULL DEFAULT 0 CHECK (actual_speeches >= 0),
  actual_meetings         INTEGER     NOT NULL DEFAULT 0 CHECK (actual_meetings >= 0),
  actual_proposals        INTEGER     NOT NULL DEFAULT 0 CHECK (actual_proposals >= 0),
  actual_closes           INTEGER     NOT NULL DEFAULT 0 CHECK (actual_closes >= 0),
  actual_revenue          NUMERIC(12,2) DEFAULT 0,
  notes                   TEXT,
  created_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at              TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_recipe_actuals_scenario_period UNIQUE (scenario_id, period_type, period_start),
  CONSTRAINT chk_recipe_actuals_dates CHECK (period_end >= period_start)
);

CREATE INDEX IF NOT EXISTS idx_recipe_actuals_scenario_id  ON recipe_actuals(scenario_id);
CREATE INDEX IF NOT EXISTS idx_recipe_actuals_period_start ON recipe_actuals(period_start);

-- ─────────────────────────────────────────────────────────────────
-- 6. updated_at auto-trigger function
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_activities_updated_at
  BEFORE UPDATE ON activities
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_goals_updated_at
  BEFORE UPDATE ON goals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_logs_updated_at
  BEFORE UPDATE ON activity_logs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_recipe_scenarios_updated_at
  BEFORE UPDATE ON recipe_scenarios
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE OR REPLACE TRIGGER trg_recipe_actuals_updated_at
  BEFORE UPDATE ON recipe_actuals
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ─────────────────────────────────────────────────────────────────
-- 7. vw_daily_compliance view
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_daily_compliance AS
SELECT
  al.id,
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

-- ─────────────────────────────────────────────────────────────────
-- 8. Seed data — example activities (optional, delete if not needed)
-- ─────────────────────────────────────────────────────────────────
INSERT INTO activities (name, type, channel, daily_goal, weekly_goal, monthly_goal, sort_order) VALUES
  ('Conversaciones por DM',          'OUTBOUND', 'linkedin_dm',       10, 50, 200, 1),
  ('Llamadas en frío',                'OUTBOUND', 'cold_call',          5, 25, 100, 2),
  ('Leads de networking atendidos',   'OUTBOUND', 'networking_lead',    3, 15,  60, 3),
  ('Leads referidos',                 'OUTBOUND', 'referral',           2, 10,  40, 4),
  ('Leads MKT atendidos',             'OUTBOUND', 'mkt_lead',           3, 15,  60, 5),
  ('Leads VSL',                       'OUTBOUND', 'vsl_lead',           2, 10,  40, 6),
  ('Eventos de networking',           'INBOUND',  'networking_event',   1,  5,  20, 7),
  ('Leads conseguidos networking',    'INBOUND',  'networking_lead',    2, 10,  40, 8),
  ('Posts en LinkedIn',               'INBOUND',  'linkedin_post',      1,  5,  20, 9),
  ('Comentarios en LinkedIn',         'INBOUND',  'linkedin_comment',   5, 25, 100, 10),
  ('Referidos gestionados',           'INBOUND',  'referral',           2, 10,  40, 11)
ON CONFLICT DO NOTHING;
