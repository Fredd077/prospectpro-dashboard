-- Add prospect_type (OUTBOUND | INBOUND) to pipeline_entries.
-- Existing rows default to 'OUTBOUND'.

ALTER TABLE pipeline_entries
  ADD COLUMN IF NOT EXISTS prospect_type TEXT
    NOT NULL DEFAULT 'OUTBOUND'
    CHECK (prospect_type IN ('OUTBOUND', 'INBOUND'));
