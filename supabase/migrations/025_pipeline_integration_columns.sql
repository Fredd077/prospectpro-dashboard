-- Add integration tracking columns to pipeline_simple
alter table public.pipeline_simple
  add column if not exists external_id        text,
  add column if not exists integration_source text;

create index if not exists idx_pipeline_simple_external_id
  on public.pipeline_simple (external_id)
  where external_id is not null;

-- Add processing state columns to webhook_logs
alter table public.webhook_logs
  add column if not exists processed_at  timestamptz,
  add column if not exists error_message text;

-- Add generic config JSONB to integrations
alter table public.integrations
  add column if not exists config jsonb not null default '{}';
