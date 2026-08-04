-- ══════════════════════════════════════════════════════════════════════
-- 039_pipeline_stages.sql
-- Lista de etapas del Pipeline, propia de cada usuario y TOTALMENTE editable.
-- Independiente de recipe_scenarios.funnel_stages: antes el Pipeline tomaba
-- prestadas las etapas del Recetario / una constante hardcodeada; ahora cada
-- usuario tiene su propia lista, editable desde la página de Pipeline.
-- NO altera nada de la lógica del Recetario (que sigue leyendo su funnel_stages).
--
-- Nota de numeración: 035 ya está usado (035_trial_period.sql); esta migración
-- toma el siguiente número libre (039).
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS pipeline_stages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  name        TEXT        NOT NULL,
  color       TEXT,
  sort_order  INTEGER     NOT NULL DEFAULT 0,
  source      TEXT        NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'crm')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pipeline_stages_user_order
  ON pipeline_stages (user_id, sort_order);

-- ─── RLS: cada usuario gestiona solo sus propias etapas ───────────────────
-- SIN "OR is_admin()": la migración 010_fix_admin_rls.sql quitó ese helper de
-- todas las tablas de datos personales (activities, activity_logs,
-- recipe_scenarios, recipe_actuals, coach_messages) y dejó documentado que el
-- acceso de admin a datos de otros usuarios va SOLO por el cliente service_role
-- (que ignora RLS). pipeline_stages es dato personal, así que sigue ese patrón
-- —el mismo de la tabla más reciente, daily_briefs (037).
ALTER TABLE pipeline_stages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pipeline_stages_own" ON pipeline_stages;
CREATE POLICY "pipeline_stages_own" ON pipeline_stages
  FOR ALL
  USING      (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── Auto-update updated_at (reutiliza el helper existente) ───────────────
DROP TRIGGER IF EXISTS pipeline_stages_updated_at ON pipeline_stages;
CREATE TRIGGER pipeline_stages_updated_at
  BEFORE UPDATE ON pipeline_stages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ══════════════════════════════════════════════════════════════════════
-- SEED: para cada usuario que ya tenga historial de pipeline y AÚN no tenga
-- etapas propias, crea una etapa por cada valor distinto de `stage` que
-- aparece hoy en sus registros. Se prefiere pipeline_simple; si ese usuario
-- no tiene filas en pipeline_simple, se usa pipeline_entries.
--
-- El orden (sort_order, desde 0) reproduce el orden del filtro de etapas de la
-- página de Pipeline: primero las 5 etapas canónicas en su orden fijo, y
-- cualquier etapa personalizada después, alfabéticamente.
-- ══════════════════════════════════════════════════════════════════════
WITH users_needing AS (
  SELECT u.user_id
  FROM (
    SELECT user_id FROM pipeline_entries
    UNION
    SELECT user_id FROM pipeline_simple
  ) u
  WHERE u.user_id IS NOT NULL
    AND NOT EXISTS (
      SELECT 1 FROM pipeline_stages ps WHERE ps.user_id = u.user_id
    )
),
user_stages AS (
  -- Prefiere pipeline_simple; usa pipeline_entries solo si el usuario no tiene
  -- ninguna fila en pipeline_simple.
  SELECT un.user_id, src.stage
  FROM users_needing un
  CROSS JOIN LATERAL (
    SELECT s.stage
      FROM pipeline_simple s
     WHERE s.user_id = un.user_id
    UNION
    SELECT e.stage
      FROM pipeline_entries e
     WHERE e.user_id = un.user_id
       AND NOT EXISTS (
         SELECT 1 FROM pipeline_simple s2 WHERE s2.user_id = un.user_id
       )
  ) src
  WHERE src.stage IS NOT NULL AND btrim(src.stage) <> ''
),
distinct_stages AS (
  SELECT DISTINCT user_id, stage FROM user_stages
),
ordered AS (
  SELECT
    user_id,
    stage,
    (row_number() OVER (
      PARTITION BY user_id
      ORDER BY
        CASE stage
          WHEN 'Cita agendada'                                    THEN 0
          WHEN 'Reagendar'                                        THEN 1
          WHEN 'Primera reu ejecutada/Propuesta en preparación'   THEN 2
          WHEN 'Propuesta Presentada'                             THEN 3
          WHEN 'Por facturar/cobrar'                              THEN 4
          ELSE 99
        END,
        stage
    ) - 1) AS sort_order
  FROM distinct_stages
)
INSERT INTO pipeline_stages (user_id, name, sort_order, source)
SELECT user_id, stage, sort_order, 'manual'
FROM ordered;
