-- Rename pipeline_simple stages to match Pipedrive stage names
alter table public.pipeline_simple
  drop constraint if exists pipeline_simple_stage_check;

update public.pipeline_simple
  set stage = 'Primera reu ejecutada/Propuesta en preparación'
  where stage = 'Reunión';

update public.pipeline_simple
  set stage = 'Propuesta Presentada'
  where stage = 'Propuesta';

update public.pipeline_simple
  set stage = 'Por facturar/cobrar'
  where stage = 'Cierre';

alter table public.pipeline_simple
  add constraint pipeline_simple_stage_check
  check (stage in (
    'Primera reu ejecutada/Propuesta en preparación',
    'Propuesta Presentada',
    'Por facturar/cobrar'
  ));
