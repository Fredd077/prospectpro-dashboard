-- Integration infrastructure: webhook endpoint + API key management
-- CRM-agnostic: any system that can HTTP POST works

-- ── integrations: one row per company (config anchor)
create table if not exists public.integrations (
  id              uuid        primary key default gen_random_uuid(),
  company_name    text        not null unique,
  admin_user_id   uuid        references public.profiles(id) on delete set null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

alter table public.integrations enable row level security;

create policy "admins can manage own integration"
  on public.integrations for all
  using (admin_user_id = auth.uid());

create policy "service role bypass integrations"
  on public.integrations for all
  using (auth.role() = 'service_role');

create index idx_integrations_company_name on public.integrations (company_name);

-- ── integration_api_keys: hashed only, plaintext never stored
create table if not exists public.integration_api_keys (
  id              uuid        primary key default gen_random_uuid(),
  company_name    text        not null,
  key_hash        text        not null unique,
  label           text,
  created_at      timestamptz not null default now(),
  last_used_at    timestamptz
);

alter table public.integration_api_keys enable row level security;

create policy "admins can manage own api keys"
  on public.integration_api_keys for all
  using (
    exists (
      select 1 from public.integrations
      where integrations.company_name = integration_api_keys.company_name
        and integrations.admin_user_id = auth.uid()
    )
  );

create policy "service role bypass api_keys"
  on public.integration_api_keys for all
  using (auth.role() = 'service_role');

create index idx_api_keys_company_name on public.integration_api_keys (company_name);

-- ── webhook_logs: append-only inbound request log
create table if not exists public.webhook_logs (
  id              uuid        primary key default gen_random_uuid(),
  company_name    text        not null,
  payload         jsonb,
  headers         jsonb,
  status          text        not null default 'received',
  created_at      timestamptz not null default now()
);

alter table public.webhook_logs enable row level security;

create policy "admins can read own webhook logs"
  on public.webhook_logs for select
  using (
    exists (
      select 1 from public.integrations
      where integrations.company_name = webhook_logs.company_name
        and integrations.admin_user_id = auth.uid()
    )
  );

create policy "service role bypass webhook_logs"
  on public.webhook_logs for all
  using (auth.role() = 'service_role');

create index idx_webhook_logs_company_name on public.webhook_logs (company_name);
create index idx_webhook_logs_created_at   on public.webhook_logs (created_at desc);
