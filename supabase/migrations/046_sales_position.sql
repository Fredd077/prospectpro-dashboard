-- ══════════════════════════════════════════════════════════════════════
-- 046_sales_position.sql
--
-- Cargo comercial del usuario: BDR/SDR (prospecta y agenda, no cierra) vs.
-- Closer (ejecuta la reunión y cierra) vs. ciclo completo (hace ambas cosas
-- — el caso por defecto hoy, sin distinción de rol).
--
-- Permite que el Recetario muestre un resumen de meta distinto según a qué
-- se dedica cada usuario, en vez de un único embudo genérico que mezcla
-- prospección y cierre como si fueran responsabilidad de la misma persona.
--
-- NULL a propósito (no se fuerza un valor): todas las cuentas existentes
-- siguen viendo el Recetario exactamente igual que hoy hasta que elijan un
-- cargo desde /settings o el onboarding. Backward/forward compatible por
-- diseño, igual que el patrón de `pipeline_stages.role` en la migración 045.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS sales_position TEXT
    CHECK (sales_position IN ('bdr_sdr', 'closer', 'full_cycle'));
