-- ══════════════════════════════════════════════════════════════════════
-- 045_pipeline_stage_roles.sql
--
-- BUG relacionado con 044: las tarjetas de resumen del Pipeline
-- (components/pipeline/PipelineSimpleBoard.tsx: Citas, Reuniones, En
-- propuesta, Cerrado, Conversión) y varios comportamientos del formulario
-- (auto-marcar Ganado, mostrar el toggle de Estado, permitir fecha futura)
-- identifican la etapa por su NOMBRE EXACTO hardcodeado ('Cita agendada',
-- 'Propuesta Presentada', 'Por facturar/cobrar', etc.). Como pipeline_stages
-- es 100% editable por el usuario (migración 039), cualquier rename rompe
-- esas tarjetas en silencio — sin error, sin negocios huérfanos, solo
-- números en cero para siempre. Confirmado en freddy.g@aitsolucionesautomaticas.com:
-- tiene 7 etapas propias que no coinciden con ninguna canónica; hoy no se
-- nota porque no tiene negocios en ellas, pero el día que los registre, esas
-- tarjetas van a quedar en cero sin avisar.
--
-- FIX: se agrega `role`, un identificador semántico ESTABLE, independiente
-- del nombre visible y de la posición/orden (que también es reordenable por
-- drag & drop). Un rename ya NO lo toca (solo cambia `name`), así que las
-- tarjetas de resumen pueden preguntar "¿cuál etapa tiene el rol cierre?" en
-- vez de "¿cuál etapa se llama exactamente Por facturar/cobrar?".
--
-- Backfill: solo se asigna automáticamente cuando el NOMBRE ACTUAL coincide
-- exacto con una de las 5 canónicas (cubre a cualquier usuario que nunca haya
-- renombrado nada, la gran mayoría). Los que ya renombraron antes de este fix
-- (ej. metodopulso7@gmail.com, "Por facturar/cobrar" -> "Cerrados") o tienen
-- etapas 100% personalizadas desde el inicio (ej. aitsolucionesautomaticas)
-- quedan en NULL a propósito: adivinar por posición sería peor (ambas cuentas
-- han reordenado o dividido etapas), y corregirlas requiere criterio humano,
-- no una regla genérica. Se resuelven aparte, a mano o desde el nuevo
-- selector de rol en el gestor de etapas.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.pipeline_stages
  ADD COLUMN IF NOT EXISTS role TEXT
    CHECK (role IN ('cita', 'reagendar', 'reunion', 'propuesta', 'cierre'));

-- A lo sumo una etapa por usuario puede tener cada rol (evita ambigüedad en
-- las tarjetas de resumen: si hubiera dos etapas "cierre", ¿cuál usar?).
CREATE UNIQUE INDEX IF NOT EXISTS pipeline_stages_user_role_unique
  ON public.pipeline_stages (user_id, role)
  WHERE role IS NOT NULL;

UPDATE public.pipeline_stages SET role = 'cita'      WHERE name = 'Cita agendada';
UPDATE public.pipeline_stages SET role = 'reagendar' WHERE name = 'Reagendar';
UPDATE public.pipeline_stages SET role = 'reunion'   WHERE name = 'Primera reu ejecutada/Propuesta en preparación';
UPDATE public.pipeline_stages SET role = 'propuesta' WHERE name = 'Propuesta Presentada';
UPDATE public.pipeline_stages SET role = 'cierre'    WHERE name = 'Por facturar/cobrar';
