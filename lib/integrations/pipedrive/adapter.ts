import type { CrmAdapter, NormalizedDealEvent } from '../types'
import { SkipError } from '../types'

type PipedriveStageConfig = {
  cita_stage?: string
  reagendar_stage?: string
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
): string | null {
  if (dealStatus === 'won') return 'Por facturar/cobrar'
  if (!stageId) return null
  const sid = String(stageId)
  if (config.cierre_stage    && sid === config.cierre_stage)    return 'Por facturar/cobrar'
  if (config.propuesta_stage && sid === config.propuesta_stage) return 'Propuesta Presentada'
  if (config.reunion_stage   && sid === config.reunion_stage)   return 'Primera reu ejecutada/Propuesta en preparación'
  if (config.reagendar_stage && sid === config.reagendar_stage) return 'Reagendar'
  if (config.cita_stage      && sid === config.cita_stage)      return 'Cita agendada'
  return null
}

export const pipedriveAdapter: CrmAdapter = {
  canHandle(payload: unknown, headers: Record<string, string>): boolean {
    // x-crm-name is injected by the route from integration.crm_name — most reliable
    if (headers['x-crm-name'] === 'pipedrive') return true
    if (headers['x-provider']?.toLowerCase() === 'pipedrive') return true
    // Structural fallback: Pipedrive always sends { event: string, meta: {...} }
    // Note: body.data can be null for delete events, so we check meta instead
    const body = payload as PipedrivePayload
    return typeof body?.event === 'string' && typeof body?.meta === 'object' && body?.meta !== null
  },

  normalize(payload: unknown, config: Record<string, unknown> | null): NormalizedDealEvent {
    const body  = payload as PipedrivePayload
    const event = body?.event
    const deal  = body?.data ?? body?.current

    if (!deal?.id) throw new SkipError('No deal id in Pipedrive payload')

    const pdConfig = parsePipedriveConfig(config)

    // Filter by owner if configured (user_id can be a number or nested {id, name} object)
    if (pdConfig.owner_id && deal.user_id !== undefined) {
      const raw    = deal.user_id
      const userId = typeof raw === 'object' ? raw?.id : raw
      if (String(userId) !== pdConfig.owner_id) {
        throw new SkipError(`Deal ${deal.id} belongs to user ${userId}, not owner ${pdConfig.owner_id}`)
      }
    }

    let action: NormalizedDealEvent['action']
    if (deal.status === 'won') {
      action = 'won'
    } else if (deal.status === 'lost' || deal.status === 'deleted' || event === 'deleted.deal') {
      action = 'lost'
    } else {
      action = 'updated'
    }

    const stage = resolveStage(deal.stage_id, deal.status, pdConfig)

    // For open deals, stage must be mapped — otherwise it's a config error the user can fix
    if (stage === null && action === 'updated') {
      throw new SkipError(`Stage ID ${deal.stage_id} not mapped in Pipedrive config`)
    }

    return {
      action,
      externalId:   String(deal.id),
      prospectName: deal.person_name ?? null,
      companyName:  deal.org_name ?? deal.title ?? null,
      amountUsd:    deal.value ?? null,
      stageInCrm:   stage,
      source:       'pipedrive',
      rawPayload:   payload,
    }
  },
}
