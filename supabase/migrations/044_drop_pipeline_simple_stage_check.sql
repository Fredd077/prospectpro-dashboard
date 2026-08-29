-- ══════════════════════════════════════════════════════════════════════
-- 044_drop_pipeline_simple_stage_check.sql
--
-- BUG: pipeline_simple_stage_check (añadido en 027_five_stages.sql) restringe
-- pipeline_simple.stage a las 5 etapas canónicas hardcodeadas. La migración
-- 039_pipeline_stages.sql convirtió las etapas del Pipeline en una lista TEXT
-- libre y editable por el usuario (tabla pipeline_stages), pero nunca eliminó
-- este constraint viejo — quedó contradiciendo el diseño actual (ver el
-- comentario en lib/actions/pipeline-simple.ts: "stage es TEXT libre... no se
-- restringe a un union de literales").
--
-- Efecto real: al renombrar cualquiera de las 5 etapas canónicas a un nombre
-- propio (p. ej. "Por facturar/cobrar" -> "Cerrados"), renamePipelineStage()
-- SÍ actualiza pipeline_stages.name (sin constraint ahí), pero el UPDATE en
-- cascada hacia pipeline_simple.stage viola este constraint y falla — dejando
-- los negocios existentes con el nombre viejo, invisibles en el Kanban (ya
-- ninguna columna se llama así) aunque siguen existiendo en la base de datos.
-- Lo mismo bloquea crear una entrada nueva bajo cualquier etapa 100% personalizada.
--
-- Reproducido y confirmado en vivo: un INSERT de prueba con stage='Cerrados'
-- fue rechazado con "violates check constraint pipeline_simple_stage_check"
-- (código Postgres 23514).
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.pipeline_simple
  DROP CONSTRAINT IF EXISTS pipeline_simple_stage_check;
