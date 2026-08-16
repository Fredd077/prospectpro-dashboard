/**
 * Sincronización periódica de todas las conexiones activas de HubSpot.
 * Mismo patrón de autenticación que los demás crons (Bearer CRON_SECRET).
 *
 * Un fallo en una empresa no detiene a las demás: se marca sync_status='error'
 * con un mensaje en español y se continúa.
 */
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { syncHubSpotCompany } from '@/lib/integrations/hubspot/sync'
import { markConnectionError } from '@/lib/integrations/hubspot/connection'
import { HubSpotAuthError, HubSpotApiError } from '@/lib/integrations/hubspot/client'

export const maxDuration = 300

export async function GET(req: Request) {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = getSupabaseServiceClient()

  // 'disconnected' queda fuera a propósito; 'error' sí se reintenta por si el
  // admin ya generó un token nuevo.
  const { data: connections, error } = await service
    .from('hubspot_connections')
    .select('company_name')
    .in('sync_status', ['pending', 'active', 'error'])

  if (error) {
    console.error('[cron/hubspot-sync] fetch connections:', error.message)
    return Response.json({ error: 'No se pudieron leer las conexiones.' }, { status: 500 })
  }

  const summary: { company: string; created?: number; updated?: number; skipped?: number; error?: string }[] = []

  for (const conn of connections ?? []) {
    const company = conn.company_name as string
    try {
      const r = await syncHubSpotCompany(service, company)
      summary.push({ company, created: r.created, updated: r.updated, skipped: r.skipped })
    } catch (err) {
      const msg =
        err instanceof HubSpotAuthError || err instanceof HubSpotApiError
          ? err.message
          : 'Error inesperado durante la sincronización.'
      // syncHubSpotCompany ya marca el error cuando falla hablando con HubSpot;
      // esto cubre el resto de casos.
      await markConnectionError(service, company, msg)
      summary.push({ company, error: msg })
      console.error('[cron/hubspot-sync]', company, err)
    }
  }

  return Response.json({ ok: true, connections: summary.length, summary })
}
