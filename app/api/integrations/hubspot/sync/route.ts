/** Sincronización manual bajo demanda — botón "Sincronizar ahora". */
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/integrations/company'
import { NoConnectionError } from '@/lib/integrations/hubspot/connection'
import { syncHubSpotCompany } from '@/lib/integrations/hubspot/sync'
import { HubSpotAuthError, HubSpotApiError } from '@/lib/integrations/hubspot/client'

export const dynamic = 'force-dynamic'
export const maxDuration = 300

export async function POST() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, company')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role === 'inactive' || profile.role === 'pending') {
    return Response.json({ error: 'Tu cuenta no está activa.' }, { status: 403 })
  }

  const company = resolveCompany(profile, user.email, user.id)
  const service = getSupabaseServiceClient()

  try {
    const result = await syncHubSpotCompany(service, company)
    return Response.json({ ok: true, ...result })
  } catch (err) {
    if (err instanceof NoConnectionError) {
      return Response.json({ error: err.message, needsConnection: true }, { status: 404 })
    }
    if (err instanceof HubSpotAuthError) {
      return Response.json({ error: err.message, needsReconnect: true }, { status: 401 })
    }
    if (err instanceof HubSpotApiError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    console.error('[hubspot/sync]', err)
    return Response.json({ error: 'No se pudo sincronizar con HubSpot.' }, { status: 500 })
  }
}
