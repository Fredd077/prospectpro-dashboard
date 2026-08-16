-- ══════════════════════════════════════════════════════════════════════
-- 043_pipeline_simple_soft_delete.sql
-- Borrado suave para negocios eliminados en el CRM de origen.
--
-- Cuando HubSpot avisa `deal.deletion`, NO se borra la fila: se marca. Así el
-- negocio desaparece de la vista activa del pipeline y deja de contar en
-- métricas e ingresos, pero el historial se conserva.
--
-- Se agrega una columna nueva en vez de reutilizar `status`: ese campo es un
-- concepto de negocio (abierto/perdido/ganado) del que dependen la definición de
-- cierre ganado y los cálculos de ingreso real. Meterle un cuarto valor obligaría
-- a revisar todos esos cálculos y podría alterarlos en silencio.
--
-- NULL = vigente. Con fecha = eliminado en el CRM en ese momento.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.pipeline_simple
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- Las lecturas filtran `deleted_at IS NULL`; el índice parcial las mantiene rápidas.
CREATE INDEX IF NOT EXISTS idx_pipeline_simple_not_deleted
  ON public.pipeline_simple (user_id, entry_date DESC)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN public.pipeline_simple.deleted_at
  IS 'Marca de borrado suave: el negocio fue eliminado en el CRM de origen. NULL = vigente. Las vistas y métricas excluyen las filas marcadas.';
