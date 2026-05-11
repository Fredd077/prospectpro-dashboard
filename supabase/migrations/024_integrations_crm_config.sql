-- Add outbound CRM config fields to integrations
alter table public.integrations
  add column if not exists crm_name       text,
  add column if not exists crm_api_key    text,
  add column if not exists crm_base_url   text;
