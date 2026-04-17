-- Tabla pipeline simplificado
CREATE TABLE IF NOT EXISTS pipeline_simple (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stage TEXT NOT NULL CHECK (stage IN ('Reunión', 'Propuesta', 'Cierre')),
  entry_date DATE NOT NULL DEFAULT CURRENT_DATE,
  company_name TEXT,
  prospect_name TEXT,
  amount_usd NUMERIC(12,2),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS pipeline_simple_user_id_idx
  ON pipeline_simple(user_id);
CREATE INDEX IF NOT EXISTS pipeline_simple_entry_date_idx
  ON pipeline_simple(entry_date);
CREATE INDEX IF NOT EXISTS pipeline_simple_stage_idx
  ON pipeline_simple(stage);

-- RLS
ALTER TABLE pipeline_simple ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own pipeline_simple"
  ON pipeline_simple
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
