/**
 * Pipelines + etapas reales de HubSpot, junto con las etapas del Pipeline del
 * usuario (pipeline_stages), para poblar los selects del mapeo.
 *
 * Las etapas de destino salen de pipeline_stages —editables por el usuario— y NO
 * de recipe_scenarios.funnel_stages: el Pipeline dejó de depender del Recetario.
 */
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/integrations/company'
import { loadConnection, NoConnectionError } from '@/lib/integrations/hubspot/connection'
import { fetchDealPipelines, HubSpotAuthError, HubSpotApiError } from '@/lib/integrations/hubspot/client'
import { CANONICAL_PIPELINE_STAGES } from '@/lib/utils/pipeline-stages'

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

  // Etapas de destino del usuario que está configurando.
  const { data: stageRows } = await sb
    .from('pipeline_stages')
    .select('name')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  const prospectProStages =
    (stageRows ?? []).length > 0
      ? (stageRows ?? []).map((s) => s.name)
      : [...CANONICAL_PIPELINE_STAGES]

  try {
    const { connection, token } = await loadConnection(service, company)
    const pipelines = await fetchDealPipelines(token)

    return Response.json({
      pipelines,
      prospectProStages,
      selectedPipelineId: connection.pipeline_id,
      stageMapping: connection.stage_mapping ?? {},
      syncStatus: connection.sync_status,
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
    console.error('[hubspot/pipelines]', err)
    return Response.json({ error: 'No se pudieron cargar los pipelines de HubSpot.' }, { status: 500 })
  }
}
