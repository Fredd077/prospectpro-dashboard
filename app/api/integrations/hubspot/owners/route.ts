/**
 * Propietarios de HubSpot, ya cruzados automáticamente por email con profiles.
 *
 * El cruce por email resuelve la mayoría sin intervención; la UI solo pide
 * asignar a mano los que quedaron sin match, y una sola vez.
 */
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/integrations/company'
import { loadConnection, NoConnectionError } from '@/lib/integrations/hubspot/connection'
import { fetchOwners, HubSpotAuthError, HubSpotApiError } from '@/lib/integrations/hubspot/client'

export const dynamic = 'force-dynamic'

export async function GET() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return Response.json({ error: 'No autenticado' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, company')
    .eq('id', user.id)
    .single()
  if (!profile) return Response.json({ error: 'Perfil no encontrado' }, { status: 403 })

  const company = resolveCompany(profile, user.email, user.id)
  const service = getSupabaseServiceClient()

  try {
    const { connection, token } = await loadConnection(service, company)
    const owners = await fetchOwners(token)

    // Candidatos de ProspectPro: los miembros de la misma empresa.
    const { data: members } = await service
      .from('profiles')
      .select('id, email, full_name')
      .eq('company', profile.company ?? '')

    const candidates = (members ?? []).map((m) => ({
      id: m.id,
      email: m.email,
      fullName: m.full_name,
    }))

    const byEmail = new Map(
      candidates.filter((c) => c.email).map((c) => [c.email!.toLowerCase(), c]),
    )
    const saved = (connection.owner_mapping ?? {}) as Record<string, string>

    const rows = owners.map((o) => {
      const auto = o.email ? byEmail.get(o.email.toLowerCase()) : undefined
      const mappedId = saved[o.id] ?? auto?.id ?? null
      return {
        hubspotOwnerId: o.id,
        hubspotEmail: o.email,
        hubspotName: [o.firstName, o.lastName].filter(Boolean).join(' ') || null,
        mappedUserId: mappedId,
        /** true = se resolvió solo por email y aún no está guardado. */
        autoMatched: !saved[o.id] && !!auto,
      }
    })

    return Response.json({
      owners: rows,
      candidates,
      unmatched: rows.filter((r) => !r.mappedUserId).length,
    })
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
    console.error('[hubspot/owners]', err)
    return Response.json({ error: 'No se pudieron cargar los propietarios de HubSpot.' }, { status: 500 })
  }
}
