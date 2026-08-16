-- ══════════════════════════════════════════════════════════════════════
-- 042_hubspot_webhook_secret.sql
-- Soporte de webhooks en tiempo real para HubSpot.
--
-- Las suscripciones de webhook de una App Privada firman cada petición con el
-- CLIENT SECRET de esa app (pestaña "Auth" → "Mostrar secreto"), distinto del
-- Private App Token que usamos para leer la API. Sin él no se puede verificar
-- que la petición venga de verdad de HubSpot, así que se guarda cifrado con el
-- mismo AES-256-GCM que el token.
--
-- Es NULLABLE a propósito: una conexión que solo use el cron de respaldo sigue
-- siendo válida sin configurar webhooks.
-- ══════════════════════════════════════════════════════════════════════

ALTER TABLE public.hubspot_connections
  ADD COLUMN IF NOT EXISTS client_secret TEXT;

-- Última vez que llegó un webhook válido — para que la UI distinga
-- "sincroniza en tiempo real" de "solo corre el respaldo diario".
ALTER TABLE public.hubspot_connections
  ADD COLUMN IF NOT EXISTS last_webhook_at TIMESTAMPTZ;

COMMENT ON COLUMN public.hubspot_connections.client_secret
  IS 'Client secret de la App Privada, cifrado (AES-256-GCM). Solo se usa para validar la firma de los webhooks entrantes.';
