-- ══════════════════════════════════════════════════════════════════════
-- 037_daily_briefs.sql
-- Brief diario del copiloto (pantalla "Mi Día"). Una fila por usuario por día,
-- para garantizar una sola llamada a la IA por usuario por día.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS daily_briefs (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  brief_date  DATE        NOT NULL,
  content     TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_daily_briefs_user_date UNIQUE (user_id, brief_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_briefs_user_date
  ON daily_briefs (user_id, brief_date);

-- ─── RLS: cada usuario solo ve/escribe sus propios briefs ──────────────
ALTER TABLE daily_briefs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "daily_briefs_own" ON daily_briefs;
CREATE POLICY "daily_briefs_own" ON daily_briefs
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());
