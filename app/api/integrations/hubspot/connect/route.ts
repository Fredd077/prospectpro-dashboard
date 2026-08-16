/**
 * Conecta HubSpot con un Private App Token.
 *
 * Valida el token contra la API REAL antes de guardar nada, para que el usuario
 * sepa de inmediato si se equivocó en algún paso de la guía. Todos los mensajes
 * de error van en español y apuntan al paso concreto: nunca se devuelve el error
 * crudo de HubSpot.
 */
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { encryptSecret, maskToken } from '@/lib/utils/crypto'
import { resolveCompany } from '@/lib/integrations/company'
import {
  validateToken,
  fetchAccountInfo,
  HubSpotAuthError,
  HubSpotApiError,
} from '@/lib/integrations/hubspot/client'

export const dynamic = 'force-dynamic'

export async function POST(req: Request) {
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

  let token = ''
  try {
    const body = await req.json()
    token = typeof body?.token === 'string' ? body.token.trim() : ''
  } catch {
    return Response.json({ error: 'Petición inválida.' }, { status: 400 })
  }

  // 1. Validar contra HubSpot ANTES de tocar la base.
  let pipelines
  try {
    pipelines = await validateToken(token)
  } catch (err) {
    if (err instanceof HubSpotAuthError) {
      return Response.json({ error: err.message }, { status: 400 })
    }
    if (err instanceof HubSpotApiError) {
      return Response.json({ error: err.message }, { status: 502 })
    }
    return Response.json({ error: 'No se pudo verificar el token con HubSpot.' }, { status: 500 })
  }

  if (pipelines.length === 0) {
    return Response.json(
      { error: 'El token funciona, pero tu cuenta de HubSpot no tiene ningún pipeline de negocios configurado.' },
      { status: 400 },
    )
  }

  // 2. Cifrar. Si falta la env var, avisar sin dejar el token en texto plano.
  let encrypted: string
  try {
    encrypted = await encryptSecret(token)
  } catch (err) {
    console.error('[hubspot/connect] cifrado:', err)
    return Response.json(
      { error: 'Falta configurar el cifrado de secretos en el servidor. Avisa al administrador.' },
      { status: 500 },
    )
  }

  const account = await fetchAccountInfo(token)
  const company = resolveCompany(profile, user.email, user.id)
  const service = getSupabaseServiceClient()

  // 3. Asegurar el ancla de empresa (misma fila que usa el flujo por webhook).
  const { error: intErr } = await service
    .from('integrations')
    .upsert(
      { company_name: company, admin_user_id: user.id, crm_name: 'HubSpot' },
      { onConflict: 'company_name' },
    )
  if (intErr) {
    console.error('[hubspot/connect] integrations upsert:', intErr.message)
    return Response.json({ error: 'No se pudo guardar la integración.' }, { status: 500 })
  }

  // 4. Guardar la conexión. Se conserva el mapeo previo si ya existía, para no
  //    perder la configuración al regenerar un token revocado.
  const { data: existing } = await service
    .from('hubspot_connections')
    .select('stage_mapping, owner_mapping, pipeline_id')
    .eq('company_name', company)
    .maybeSingle()

  const { error: connErr } = await service
    .from('hubspot_connections')
    .upsert(
      {
        company_name:         company,
        connected_by_user_id: user.id,
        private_app_token:    encrypted,
        hub_id:               account.hubId,
        hub_domain:           account.hubDomain,
        pipeline_id:          existing?.pipeline_id ?? pipelines[0].id,
        stage_mapping:        existing?.stage_mapping ?? {},
        owner_mapping:        existing?.owner_mapping ?? {},
        sync_status:          'pending',
        last_sync_error:      null,
      },
      { onConflict: 'company_name' },
    )

  if (connErr) {
    console.error('[hubspot/connect] hubspot_connections upsert:', connErr.message)
    return Response.json({ error: 'No se pudo guardar la conexión con HubSpot.' }, { status: 500 })
  }

  // El token NUNCA vuelve al frontend: solo su versión enmascarada.
  return Response.json({
    ok: true,
    maskedToken: maskToken(token),
    hubId: account.hubId,
    hubDomain: account.hubDomain,
    pipelines,
    selectedPipelineId: existing?.pipeline_id ?? pipelines[0].id,
  })
}
