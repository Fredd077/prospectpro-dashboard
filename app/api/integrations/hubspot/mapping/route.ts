/**
 * Guarda el mapeo de etapas y propietarios elegido en los dropdowns.
 * (No estaba en la lista original de rutas del spec, pero los selects necesitan
 * dónde persistir; se mantiene el mismo estilo que las demás.)
 */
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { resolveCompany } from '@/lib/integrations/company'
import { encryptSecret } from '@/lib/utils/crypto'

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

  let pipelineId: string | null = null
  let stageMapping: Record<string, string> = {}
  let ownerMapping: Record<string, string> = {}
  let clientSecret: string | null = null
  try {
    const body = await req.json()
    pipelineId   = typeof body?.pipelineId === 'string' ? body.pipelineId : null
    stageMapping = body?.stageMapping && typeof body.stageMapping === 'object' ? body.stageMapping : {}
    ownerMapping = body?.ownerMapping && typeof body.ownerMapping === 'object' ? body.ownerMapping : {}
    clientSecret = typeof body?.clientSecret === 'string' && body.clientSecret.trim()
      ? body.clientSecret.trim()
      : null
  } catch {
    return Response.json({ error: 'Petición inválida.' }, { status: 400 })
  }

  // Solo se guardan etapas que existan de verdad en el Pipeline del usuario, para
  // que la sincronización nunca apunte a una etapa borrada.
  const { data: stageRows } = await sb
    .from('pipeline_stages')
    .select('name')
    .eq('user_id', user.id)
  const valid = new Set((stageRows ?? []).map((s) => s.name))

  const cleanedStages: Record<string, string> = {}
  const rejected: string[] = []
  for (const [hsStageId, ppStage] of Object.entries(stageMapping)) {
    if (typeof ppStage !== 'string' || !ppStage) continue
    if (valid.size > 0 && !valid.has(ppStage)) { rejected.push(ppStage); continue }
    cleanedStages[hsStageId] = ppStage
  }

  const company = resolveCompany(profile, user.email, user.id)
  const service = getSupabaseServiceClient()

  const patch: Record<string, unknown> = {
    stage_mapping: cleanedStages,
    owner_mapping: ownerMapping,
  }
  if (pipelineId) patch.pipeline_id = pipelineId

  // Client secret de la App Privada: habilita los webhooks en tiempo real.
  // Se cifra igual que el token y nunca vuelve al frontend.
  if (clientSecret) {
    try {
      patch.client_secret = await encryptSecret(clientSecret)
    } catch (err) {
      console.error('[hubspot/mapping] cifrado del secreto:', err)
      return Response.json(
        { error: 'Falta configurar el cifrado de secretos en el servidor. Avisa al administrador.' },
        { status: 500 },
      )
    }
  }

  const { error } = await service
    .from('hubspot_connections')
    .update(patch)
    .eq('company_name', company)

  if (error) {
    console.error('[hubspot/mapping]', error.message)
    return Response.json({ error: 'No se pudo guardar el mapeo.' }, { status: 500 })
  }

  return Response.json({
    ok: true,
    savedStages: Object.keys(cleanedStages).length,
    savedOwners: Object.keys(ownerMapping).length,
    ...(rejected.length > 0 && {
      warning: `Se ignoraron ${rejected.length} etapa(s) que ya no existen en tu Pipeline.`,
    }),
  })
}
