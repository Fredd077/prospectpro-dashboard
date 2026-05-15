-- Expand pipeline_simple stages to match Pipedrive's 5-stage pipeline
alter table public.pipeline_simple
  drop constraint if exists pipeline_simple_stage_check;

alter table public.pipeline_simple
  add constraint pipeline_simple_stage_check
  check (stage in (
    'Cita agendada',
    'Reagendar',
    'Primera reu ejecutada/Propuesta en preparación',
    'Propuesta Presentada',
    'Por facturar/cobrar'
  ));
