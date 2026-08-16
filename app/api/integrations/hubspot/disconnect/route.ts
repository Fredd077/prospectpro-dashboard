/**
 * Desconecta HubSpot: borra la conexión y el token cifrado de ProspectPro.
 *
 * NO puede revocar el token en HubSpot — eso solo lo hace el admin desde su
 * propia cuenta (Configuración → Integraciones → Aplicaciones privadas). La respuesta lo
 * dice explícitamente para que el usuario sepa que le queda ese paso si quiere
 * invalidarlo del todo.
 */
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/integrations/company'

export const dynamic = 'force-dynamic'

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

  const { error } = await service
    .from('hubspot_connections')
    .delete()
    .eq('company_name', company)

  if (error) {
    console.error('[hubspot/disconnect]', error.message)
    return Response.json({ error: 'No se pudo desconectar la integración.' }, { status: 500 })
  }

  return Response.json({
    ok: true,
    note: 'La conexión se eliminó de ProspectPro. Si además quieres invalidar el token, bórralo en HubSpot: Configuración → Integraciones → Aplicaciones privadas.',
  })
}
