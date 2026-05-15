import type { SupabaseClient } from '@supabase/supabase-js'

type PipedriveStageConfig = {
  reunion_stage?: string
  propuesta_stage?: string
  cierre_stage?: string
  owner_id?: string
}

type PipedriveDeal = {
  id?: number
  title?: string
  value?: number
  stage_id?: number
  status?: 'open' | 'won' | 'lost' | 'deleted'
  person_name?: string
  org_name?: string
  user_id?: number | { id?: number; name?: string; email?: string }
}

type PipedrivePayload = {
  event?: string
  data?: PipedriveDeal
  current?: PipedriveDeal
  meta?: Record<string, unknown>
}

export type ProcessResult = {
  action: 'created' | 'updated' | 'skipped'
  message: string
}

type IntegrationRow = {
  admin_user_id: string | null
  config: Record<string, unknown> | null
}

function parsePipedriveConfig(config: Record<string, unknown> | null): PipedriveStageConfig {
  if (!config) return {}
  const pd = config['pipedrive']
  if (!pd || typeof pd !== 'object') return {}
  return pd as PipedriveStageConfig
}

function resolveStage(
  stageId: number | undefined,
  dealStatus: string | undefined,
  config: PipedriveStageConfig,
): 'Primera reu ejecutada/Propuesta en preparación' | 'Propuesta Presentada' | 'Por facturar/cobrar' | null {
  if (dealStatus === 'won') return 'Por facturar/cobrar'
  if (!stageId) return null
  const sid = String(stageId)
  if (config.cierre_stage    && sid === config.cierre_stage)    return 'Por facturar/cobrar'
  if (config.propuesta_stage && sid === config.propuesta_stage) return 'Propuesta Presentada'
  if (config.reunion_stage   && sid === config.reunion_stage)   return 'Primera reu ejecutada/Propuesta en preparación'
  return null
}

export async function processPipedriveEvent(
  payload: unknown,
  integration: IntegrationRow,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
): Promise<ProcessResult> {
  const body  = payload as PipedrivePayload
  const event = body?.event
  const deal  = body?.data ?? body?.current

  if (!deal?.id) {
    return { action: 'skipped', message: 'No deal id in payload' }
  }

  const dealId  = String(deal.id)
  const config  = parsePipedriveConfig(integration.config)
  const adminId = integration.admin_user_id

  if (!adminId) {
    return { action: 'skipped', message: 'No admin_user_id on integration' }
  }

  // Filter by owner if configured (user_id can be a number or nested {id, name} object)
  if (config.owner_id && deal.user_id !== undefined) {
    const rawUserId = deal.user_id
    const userId = typeof rawUserId === 'object' ? rawUserId?.id : rawUserId
    if (String(userId) !== config.owner_id) {
      return { action: 'skipped', message: `Deal ${dealId} belongs to user ${userId}, not owner ${config.owner_id}` }
    }
  }

  let entryStatus: 'abierto' | 'perdido' | 'ganado' = 'abierto'
  if (deal.status === 'won') {
    entryStatus = 'ganado'
  } else if (deal.status === 'lost' || deal.status === 'deleted' || event === 'deleted.deal') {
    entryStatus = 'perdido'
  }

  const stage = resolveStage(deal.stage_id, deal.status, config)

  if (!stage && entryStatus === 'abierto') {
    return { action: 'skipped', message: `Stage ID ${deal.stage_id} not mapped in Pipedrive config` }
  }

  const finalStage = stage ?? 'Propuesta Presentada'

  const { data: existing } = await service
    .from('pipeline_simple')
    .select('id')
    .eq('external_id', dealId)
    .eq('integration_source', 'pipedrive')
    .eq('user_id', adminId)
    .maybeSingle()

  if (existing) {
    await service
      .from('pipeline_simple')
      .update({
        stage:         finalStage,
        status:        entryStatus,
        company_name:  deal.org_name ?? deal.title ?? null,
        prospect_name: deal.person_name ?? null,
        amount_usd:    deal.value ?? null,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', existing.id)
    return { action: 'updated', message: `Deal ${dealId} → ${finalStage} / ${entryStatus}` }
  }

  await service
    .from('pipeline_simple')
    .insert({
      user_id:            adminId,
      stage:              finalStage,
      status:             entryStatus,
      prospect_type:      'outbound',
      entry_date:         new Date().toISOString().slice(0, 10),
      company_name:       deal.org_name ?? deal.title ?? null,
      prospect_name:      deal.person_name ?? null,
      amount_usd:         deal.value ?? null,
      external_id:        dealId,
      integration_source: 'pipedrive',
    })
  return { action: 'created', message: `Deal ${dealId} → ${finalStage} / ${entryStatus}` }
}
