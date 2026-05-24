-- ── Intelligence Reports ─────────────────────────────────────────────────────
-- Stores AI-generated reports with data-hash-based cache invalidation.
-- Write operations use the service role (bypasses RLS).

CREATE TABLE IF NOT EXISTS public.intelligence_reports (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  report_audience  TEXT        NOT NULL CHECK (report_audience IN ('vendedor', 'gerente')),
  period_type      TEXT        NOT NULL CHECK (period_type IN ('daily', 'weekly', 'monthly')),
  period_start     DATE        NOT NULL,
  period_end       DATE        NOT NULL,
  data_hash        TEXT        NOT NULL,
  report_content   JSONB       NOT NULL,
  agent_diagnostico JSONB,
  agent_prediccion  JSONB,
  confidence_level TEXT        CHECK (confidence_level IN ('inicial', 'parcial', 'completo')),
  periods_analyzed INTEGER,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast cache lookup: exact match on identity + hash
CREATE INDEX IF NOT EXISTS intelligence_reports_cache_idx
  ON public.intelligence_reports (user_id, report_audience, period_type, period_start, data_hash);

-- List recent reports per user
CREATE INDEX IF NOT EXISTS intelligence_reports_recent_idx
  ON public.intelligence_reports (user_id, created_at DESC);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE public.intelligence_reports ENABLE ROW LEVEL SECURITY;

-- Vendors see only their own reports
CREATE POLICY "intelligence_reports_own"
  ON public.intelligence_reports
  FOR SELECT
  USING (auth.uid() = user_id);

-- Managers see 'gerente' reports for members of their same company
CREATE POLICY "intelligence_reports_manager"
  ON public.intelligence_reports
  FOR SELECT
  USING (
    report_audience = 'gerente'
    AND EXISTS (
      SELECT 1
      FROM public.profiles AS mgr
      JOIN public.profiles AS member ON member.company = mgr.company
      WHERE mgr.id       = auth.uid()
        AND mgr.org_role = 'manager'
        AND member.id    = intelligence_reports.user_id
    )
  );
