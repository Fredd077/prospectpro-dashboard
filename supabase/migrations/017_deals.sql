-- ─── Limpiar datos de prueba ──────────────────────────
TRUNCATE TABLE pipeline_entries CASCADE;

-- ─── Tabla deals ─────────────────────────────────────
-- Un "deal" es un trato comercial con ciclo de vida.
-- pipeline_entries pasa a ser el historial de movimientos.

CREATE TABLE deals (
  id                 UUID         DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id            UUID         NOT NULL
                       REFERENCES auth.users(id) ON DELETE CASCADE,
  recipe_scenario_id UUID
                       REFERENCES recipe_scenarios(id) ON DELETE SET NULL,

  -- Identificación del prospecto (todo opcional)
  company_name       TEXT,
  prospect_name      TEXT,

  -- Tipo y etapa
  prospect_type      TEXT         NOT NULL DEFAULT 'OUTBOUND'
                       CHECK (prospect_type IN ('OUTBOUND', 'INBOUND')),
  current_stage      TEXT         NOT NULL,

  -- Estado del trato
  status             TEXT         NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'won', 'lost')),

  -- Monto (opcional)
  amount_usd         NUMERIC(12,2),

  -- Si se perdió
  lost_reason        TEXT,
  lost_at_stage      TEXT,

  -- Fechas
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  closed_at          TIMESTAMPTZ,

  -- Fecha de entrada al pipeline (en timezone Colombia)
  entry_date         DATE         NOT NULL DEFAULT CURRENT_DATE
);

-- RLS
ALTER TABLE deals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "deals_own" ON deals
  FOR ALL USING (user_id = auth.uid());

-- Índices
CREATE INDEX idx_deals_user_status
  ON deals(user_id, status);
CREATE INDEX idx_deals_user_stage
  ON deals(user_id, current_stage);
CREATE INDEX idx_deals_entry_date
  ON deals(user_id, entry_date DESC);

-- Auto-update updated_at
CREATE TRIGGER deals_updated_at
  BEFORE UPDATE ON deals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── Agregar deal_id a pipeline_entries ──────────────
-- pipeline_entries ahora registra cada movimiento de etapa.
-- Cada movimiento apunta al trato que se movió.

ALTER TABLE pipeline_entries
  ADD COLUMN IF NOT EXISTS deal_id UUID
    REFERENCES deals(id) ON DELETE CASCADE;

ALTER TABLE pipeline_entries
  ADD COLUMN IF NOT EXISTS from_stage TEXT;

-- from_stage = etapa de origen (null = primer registro)
-- stage = etapa de destino (ya existía)

CREATE INDEX idx_pipeline_entries_deal_id
  ON pipeline_entries(deal_id);
