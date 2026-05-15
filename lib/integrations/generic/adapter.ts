import type { CrmAdapter, NormalizedDealEvent } from '../types'
import { SkipError } from '../types'

export type GenericAdapterConfig = {
  id_field?: string
  deal_name_field?: string
  amount_field?: string
  stage_field?: string
  won_value?: string
  lost_value?: string
}

function parseGenericConfig(config: Record<string, unknown> | null): GenericAdapterConfig {
  if (!config) return {}
  const g = config['generic']
  if (!g || typeof g !== 'object') return {}
  return g as GenericAdapterConfig
}

function pickField(obj: Record<string, unknown>, configured: string | undefined, fallbacks: string[]): unknown {
  if (configured && obj[configured] !== undefined) return obj[configured]
  for (const key of fallbacks) {
    if (obj[key] !== undefined) return obj[key]
  }
  return undefined
}

export const genericAdapter: CrmAdapter = {
  // Always returns true — registered last so it only runs when no specific adapter matched
  canHandle(): boolean {
    return true
  },

  normalize(payload: unknown, config: Record<string, unknown> | null): NormalizedDealEvent {
    if (!payload || typeof payload !== 'object') {
      throw new SkipError('Payload is not a JSON object')
    }
    const body = payload as Record<string, unknown>
    const gc   = parseGenericConfig(config)

    const id = pickField(body, gc.id_field, ['id', 'deal_id', 'opportunity_id', 'record_id'])
    if (id === undefined || id === null) {
      throw new SkipError('No id field found in payload — configure id_field in Integraciones')
    }

    const name   = pickField(body, gc.deal_name_field, ['name', 'title', 'deal_name', 'subject', 'contact_name'])
    const amount = pickField(body, gc.amount_field,    ['amount', 'value', 'deal_value', 'revenue'])
    const stage  = pickField(body, gc.stage_field,     ['stage', 'stage_name', 'pipeline_stage', 'status_label'])
    const status = pickField(body, undefined,           ['status', 'deal_status', 'state', 'outcome'])

    let action: NormalizedDealEvent['action'] = 'updated'
    if (gc.won_value  && status !== undefined && String(status) === gc.won_value)  action = 'won'
    if (gc.lost_value && status !== undefined && String(status) === gc.lost_value) action = 'lost'

    return {
      action,
      externalId:   String(id),
      prospectName: name  != null ? String(name)   : null,
      companyName:  name  != null ? String(name)   : null,
      amountUsd:    amount != null ? (Number(amount) || null) : null,
      stageInCrm:   stage != null ? String(stage)  : null,
      source:       'generic',
      rawPayload:   payload,
    }
  },
}
