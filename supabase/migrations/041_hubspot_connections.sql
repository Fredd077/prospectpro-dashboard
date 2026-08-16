-- ══════════════════════════════════════════════════════════════════════
-- 041_hubspot_connections.sql
-- Integración nativa con HubSpot vía App Privada (Private App Token).
-- No hay OAuth: el admin de HubSpot del cliente crea una app privada dentro de
-- su propia cuenta y pega el token `pat-...` en ProspectPro.
--
-- Se ancla a `integrations.company_name` (una fila por empresa), el mismo
-- agrupador que ya usa el flujo genérico por webhook. NO se crea una tabla
-- `companies`: la empresa sigue derivándose de profiles.company (texto).
--
-- IDEMPOTENCIA: deliberadamente NO se agrega una columna hubspot_deal_id.
-- pipeline_simple ya tiene external_id + integration_source (migración 025) y es
-- lo que usa el adapter de Pipedrive; HubSpot reutiliza ese mismo mecanismo con
-- integration_source = 'hubspot'. Dos claves de conflicto en paralelo serían dos
-- fuentes de verdad.
-- ══════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.hubspot_connections (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Mismo agrupador que integrations.company_name. Una conexión por empresa.
  company_name          TEXT        NOT NULL UNIQUE
                                    REFERENCES public.integrations(company_name) ON DELETE CASCADE,
  connected_by_user_id  UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  -- Cifrado en reposo con AES-256-GCM (lib/utils/crypto.ts).
  -- Formato: v1:<iv_hex>:<ciphertext_hex>. NUNCA se expone al frontend.
  private_app_token     TEXT        NOT NULL,
  hub_id                TEXT,
  hub_domain            TEXT,
  pipeline_id           TEXT,
  -- { "<hubspot_stage_id>": "<nombre de etapa en pipeline_stages>" }
  stage_mapping         JSONB       NOT NULL DEFAULT '{}',
  -- { "<hubspot_owner_id>": "<profiles.id>" }
  owner_mapping         JSONB       NOT NULL DEFAULT '{}',
  sync_status           TEXT        NOT NULL DEFAULT 'pending'
                                    CHECK (sync_status IN ('pending', 'active', 'error', 'disconnected')),
  last_sync_at          TIMESTAMPTZ,
  last_sync_error       TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hubspot_connections_company
  ON public.hubspot_connections (company_name);

CREATE INDEX IF NOT EXISTS idx_hubspot_connections_status
  ON public.hubspot_connections (sync_status);

-- ─── RLS: mismo patrón que integration_api_keys ───────────────────────────
ALTER TABLE public.hubspot_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "admins can manage own hubspot connection" ON public.hubspot_connections;
CREATE POLICY "admins can manage own hubspot connection"
  ON public.hubspot_connections FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.integrations
       WHERE integrations.company_name  = hubspot_connections.company_name
         AND integrations.admin_user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "service role bypass hubspot_connections" ON public.hubspot_connections;
CREATE POLICY "service role bypass hubspot_connections"
  ON public.hubspot_connections FOR ALL
  USING (auth.role() = 'service_role');

-- ─── updated_at ───────────────────────────────────────────────────────────
-- set_updated_at() es el helper real del proyecto (001_initial_schema.sql).
DROP TRIGGER IF EXISTS hubspot_connections_updated_at ON public.hubspot_connections;
CREATE TRIGGER hubspot_connections_updated_at
  BEFORE UPDATE ON public.hubspot_connections
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
