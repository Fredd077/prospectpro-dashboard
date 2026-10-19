-- ══════════════════════════════════════════════════════════════════════
-- 047_pipeline_stage_role_contacto.sql
--
-- Agrega el rol 'contacto' (primer contacto, antes de agendar la cita) al
-- CHECK de pipeline_stages.role — ver migración 045 para el resto de roles.
--
-- Motivo: para un BDR/SDR, la primera etapa real no es "Cita agendada" sino
-- el primer contacto — sin esa etapa no se puede medir contacto→agendado,
-- agendado→asistió ni asistió→califica, que es justamente lo que un BDR/SDR
-- necesita ver (ver migración 046, cargo comercial).
--
-- CANONICAL_PIPELINE_STAGES pasa de 5 a 6 etapas (se agrega "Contactado" al
-- inicio) — esto SOLO afecta cuentas nuevas sin etapas propias todavía (el
-- sembrado automático de getPipelineStages). Las cuentas existentes no
-- cambian: pueden agregar "Contactado" manualmente desde "+ Agregar" en
-- Gestionar etapas, con auto-sugerencia de rol, igual que cualquier etapa
-- nueva (ver ROLE_FILL_ORDER en lib/actions/pipeline-stages.ts).
--
-- El nombre del constraint generado por Postgres en la migración 045 no se
-- guardó explícitamente (CHECK inline, sin CONSTRAINT nombrado), así que se
-- busca dinámicamente en information_schema en vez de asumir
-- 'pipeline_stages_role_check' a ciegas.
-- ══════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  constraint_name text;
BEGIN
  SELECT con.conname INTO constraint_name
  FROM pg_constraint con
  JOIN pg_class rel ON rel.oid = con.conrelid
  WHERE rel.relname = 'pipeline_stages'
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) LIKE '%role%cita%reagendar%reunion%propuesta%cierre%';

  IF constraint_name IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.pipeline_stages DROP CONSTRAINT %I', constraint_name);
  END IF;
END $$;

ALTER TABLE public.pipeline_stages
  ADD CONSTRAINT pipeline_stages_role_check
    CHECK (role IN ('contacto', 'cita', 'reagendar', 'reunion', 'propuesta', 'cierre'));
