-- AI Prompt Configurations
-- Allows admins to customize the system prompts, max tokens, tone,
-- and extra instructions for each AI-powered section of the app.

create table if not exists public.ai_prompt_configs (
  id              uuid        primary key default gen_random_uuid(),
  section_key     text        not null unique,          -- 'coach' | 'recipe' | 'gerente_chat' | 'team_report'
  display_name    text        not null,
  description     text        not null default '',
  system_prompt   text        not null,
  max_tokens      integer     not null default 500 check (max_tokens between 100 and 4000),
  tone            text        not null default 'profesional',  -- profesional | motivacional | analítico | directo
  language        text        not null default 'es',
  extra_instructions text     not null default '',
  settings        jsonb       not null default '{}',    -- section-specific extras (e.g. per-frequency tokens for coach)
  is_active       boolean     not null default true,
  updated_at      timestamptz not null default now(),
  updated_by      uuid        references public.profiles(id) on delete set null
);

-- RLS: only admins can read/write
alter table public.ai_prompt_configs enable row level security;

create policy "admins can read ai_prompt_configs"
  on public.ai_prompt_configs for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

create policy "admins can write ai_prompt_configs"
  on public.ai_prompt_configs for all
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- Trigger to keep updated_at fresh
create or replace function public.touch_ai_prompt_configs()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger ai_prompt_configs_updated
  before update on public.ai_prompt_configs
  for each row execute function public.touch_ai_prompt_configs();

-- Service role can always read (for API routes)
create policy "service role bypass ai_prompt_configs"
  on public.ai_prompt_configs for select
  using (auth.role() = 'service_role');
