/**
 * Motor de sincronización de HubSpot → pipeline_simple.
 * Lo comparten la ruta manual ("Sincronizar ahora") y el cron.
 *
 * Idempotencia: reutiliza pipeline_simple.external_id + integration_source
 * ('hubspot'), el mismo mecanismo del adapter de Pipedrive. NO existe una
 * columna hubspot_deal_id: dos claves de conflicto serían dos fuentes de verdad.
 *
 * Ganado/perdido NO se configura a mano: sale de los metadatos de la Pipelines
 * API (isClosed + probability 1/0).
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { processDealEvent } from '@/lib/integrations/core/deal-processor'
import { SkipError } from '@/lib/integrations/types'
import type { NormalizedDealEvent } from '@/lib/integrations/types'
import {
  fetchDealPipelines,
  searchDealsModifiedSince,
  HubSpotAuthError,
  HubSpotApiError,
} from './client'
import type { HubSpotDeal, HubSpotPipeline } from './client'
import { loadConnection, markConnectionError } from './connection'

export interface SyncResult {
  created: number
  updated: number
  skipped: number
  errors: number
  /** Motivos de descarte, para mostrarlos en la UI sin abrir logs. */
  notes: string[]
}

/** stageId de HubSpot → metadatos que definen ganado/perdido. */
export type StageMeta = Map<string, { isClosed: boolean; probability: number }>

export function buildStageMeta(pipelines: HubSpotPipeline[]): StageMeta {
  const meta: StageMeta = new Map()
  for (const p of pipelines) {
    for (const s of p.stages) {
      meta.set(s.id, { isClosed: s.isClosed, probability: s.probability })
    }
  }
  return meta
}

export type ApplyOutcome =
  | { outcome: 'created' | 'updated' }
  | { outcome: 'skipped'; reason: 'sin-etapa' | 'etapa-no-mapeada' | 'descartado' }

/**
 * Aplica UN negocio de HubSpot al pipeline. Lo comparten la sincronización
 * periódica y el webhook en tiempo real, para que ambos caminos produzcan
 * exactamente el mismo resultado.
 */
export async function applyDealToPipeline(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  opts: {
    deal: HubSpotDeal
    stageMapping: Record<string, string>
    ownerMapping: Record<string, string>
    stageMeta: StageMeta
    fallbackUserId: string
  },
): Promise<ApplyOutcome> {
  const { deal, stageMapping, ownerMapping, stageMeta, fallbackUserId } = opts

  if (!deal.stageId) return { outcome: 'skipped', reason: 'sin-etapa' }

  const mappedStage = stageMapping[deal.stageId]
  if (!mappedStage) return { outcome: 'skipped', reason: 'etapa-no-mapeada' }

  // Ganado/perdido sale de los metadatos del pipeline, no de configuración manual.
  const meta = stageMeta.get(deal.stageId)
  let action: NormalizedDealEvent['action'] = 'updated'
  if (meta?.isClosed) action = meta.probability >= 1 ? 'won' : 'lost'

  const targetUserId = (deal.ownerId && ownerMapping[deal.ownerId]) || fallbackUserId

  const event: NormalizedDealEvent = {
    action,
    externalId:   deal.id,
    prospectName: null,
    companyName:  deal.name,
    amountUsd:    deal.amount,
    stageInCrm:   mappedStage,
    source:       'hubspot',
    rawPayload:   deal,
  }

  try {
    const r = await processDealEvent(event, targetUserId, service)
    return { outcome: r.action }
  } catch (err) {
    if (err instanceof SkipError) return { outcome: 'skipped', reason: 'descartado' }
    throw err
  }
}

/** Ventana inicial cuando nunca se ha sincronizado: 90 días hacia atrás. */
const FIRST_SYNC_DAYS = 90

export async function syncHubSpotCompany(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  companyName: string,
): Promise<SyncResult> {
  const result: SyncResult = { created: 0, updated: 0, skipped: 0, errors: 0, notes: [] }

  const { connection, token } = await loadConnection(service, companyName)

  const stageMapping = (connection.stage_mapping ?? {}) as Record<string, string>
  const ownerMapping = (connection.owner_mapping ?? {}) as Record<string, string>

  if (Object.keys(stageMapping).length === 0) {
    result.notes.push('Aún no has asociado las etapas de HubSpot con las de tu Pipeline.')
    return result
  }

  const since =
    connection.last_sync_at ??
    new Date(Date.now() - FIRST_SYNC_DAYS * 24 * 60 * 60 * 1000).toISOString()

  let pipelines
  let deals
  try {
    pipelines = await fetchDealPipelines(token)
    deals = await searchDealsModifiedSince(token, since, connection.pipeline_id)
  } catch (err) {
    const msg =
      err instanceof HubSpotAuthError || err instanceof HubSpotApiError
        ? err.message
        : 'Error inesperado al hablar con HubSpot.'
    await markConnectionError(service, companyName, msg)
    throw err
  }

  const stageMeta = buildStageMeta(pipelines)

  // Dueño por defecto cuando el owner de HubSpot no está mapeado.
  const fallbackUserId = connection.connected_by_user_id
  const unmappedOwners = new Set<string>()
  const unmappedStages = new Set<string>()

  for (const deal of deals) {
    if (deal.ownerId && !ownerMapping[deal.ownerId]) unmappedOwners.add(deal.ownerId)
    if (deal.stageId && !stageMapping[deal.stageId]) unmappedStages.add(deal.stageId)

    try {
      const r = await applyDealToPipeline(service, {
        deal, stageMapping, ownerMapping, stageMeta, fallbackUserId,
      })
      if (r.outcome === 'created') result.created++
      else if (r.outcome === 'updated') result.updated++
      else result.skipped++
    } catch (err) {
      result.errors++
      console.error('[hubspot/sync] deal', deal.id, err)
    }
  }

  if (unmappedStages.size > 0) {
    result.notes.push(
      `${unmappedStages.size} etapa(s) de HubSpot sin asociar: esos negocios no se importaron.`,
    )
  }
  if (unmappedOwners.size > 0) {
    result.notes.push(
      `${unmappedOwners.size} propietario(s) de HubSpot sin asociar: sus negocios quedaron a nombre de quien conectó la integración.`,
    )
  }

  await service
    .from('hubspot_connections')
    .update({
      sync_status:     'active',
      last_sync_at:    new Date().toISOString(),
      last_sync_error: null,
    })
    .eq('company_name', companyName)

  return result
}
