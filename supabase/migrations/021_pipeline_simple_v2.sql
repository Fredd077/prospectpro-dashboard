ALTER TABLE pipeline_simple
  ADD COLUMN IF NOT EXISTS status TEXT
    NOT NULL DEFAULT 'abierto'
    CHECK (status IN ('abierto', 'perdido', 'ganado')),
  ADD COLUMN IF NOT EXISTS prospect_type TEXT
    NOT NULL DEFAULT 'outbound'
    CHECK (prospect_type IN ('inbound', 'outbound'));
