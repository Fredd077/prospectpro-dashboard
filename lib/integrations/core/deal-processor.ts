import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedDealEvent } from '../types'

export type ProcessResult = {
  action: 'created' | 'updated'
  message: string
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processDealEvent(
  event: NormalizedDealEvent,
  adminId: string,
  service: SupabaseClient<any>,
): Promise<ProcessResult> {
  const stage = event.stageInCrm ?? 'Propuesta Presentada'

  let status: 'abierto' | 'ganado' | 'perdido' = 'abierto'
  if (event.action === 'won')  status = 'ganado'
  if (event.action === 'lost') status = 'perdido'

  const { data: existing } = await service
    .from('pipeline_simple')
    .select('id')
    .eq('external_id', event.externalId)
    .eq('integration_source', event.source)
    .eq('user_id', adminId)
    .maybeSingle()

  if (existing) {
    const { error } = await service
      .from('pipeline_simple')
      .update({
        stage,
        status,
        company_name:  event.companyName,
        prospect_name: event.prospectName,
        amount_usd:    event.amountUsd,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw new Error(`DB update failed: ${error.message}`)
    return { action: 'updated', message: `${event.source}:${event.externalId} → ${stage} / ${status}` }
  }

  const { error } = await service
    .from('pipeline_simple')
    .insert({
      user_id:            adminId,
      stage,
      status,
      prospect_type:      'outbound',
      entry_date:         new Date().toISOString().slice(0, 10),
      company_name:       event.companyName,
      prospect_name:      event.prospectName,
      amount_usd:         event.amountUsd,
      external_id:        event.externalId,
      integration_source: event.source,
    })
  if (error) throw new Error(`DB insert failed: ${error.message}`)
  return { action: 'created', message: `${event.source}:${event.externalId} → ${stage} / ${status}` }
}
