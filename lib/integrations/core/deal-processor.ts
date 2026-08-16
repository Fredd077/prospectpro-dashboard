import type { SupabaseClient } from '@supabase/supabase-js'
import type { NormalizedDealEvent } from '../types'
import { SkipError } from '../types'
import { CANONICAL_PIPELINE_STAGES } from '@/lib/utils/pipeline-stages'

const CIERRE_STAGE = 'Por facturar/cobrar'

/**
 * Etapas válidas para un usuario: las suyas propias de pipeline_stages.
 *
 * Antes era un Set hardcodeado con las 5 canónicas. Desde que las etapas del
 * Pipeline son editables (migraciones 039/040), un usuario puede renombrarlas o
 * crear las suyas, y esa lista fija habría descartado en silencio cualquier deal
 * mapeado a una etapa personalizada.
 *
 * Fallback a las canónicas si el usuario aún no tiene ninguna fila (usuario
 * nuevo que no ha abierto el gestor de etapas): sin él, un Set vacío rechazaría
 * todo. Para cualquier usuario ya existente esto es un SUPERCONJUNTO de la lista
 * fija anterior, así que no puede romper integraciones que hoy funcionan.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function loadValidStages(userId: string, service: SupabaseClient<any>): Promise<Set<string>> {
  const { data } = await service
    .from('pipeline_stages')
    .select('name')
    .eq('user_id', userId)

  const names = (data ?? []).map((r: { name: string }) => r.name)
  return names.length > 0 ? new Set(names) : new Set<string>(CANONICAL_PIPELINE_STAGES)
}

export type ProcessResult = {
  action: 'created' | 'updated'
  message: string
}

/**
 * @param targetUserId  usuario de ProspectPro al que pertenece el negocio.
 *   El webhook sigue pasando integration.admin_user_id (comportamiento intacto);
 *   la sincronización de HubSpot pasa el dueño resuelto por owner_mapping.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function processDealEvent(
  event: NormalizedDealEvent,
  targetUserId: string,
  service: SupabaseClient<any>,
): Promise<ProcessResult> {
  const validStages = await loadValidStages(targetUserId, service)

  // Los eventos 'won' aterrizan en la etapa de cierre, como siempre. Pero si el
  // usuario borró esa etapa canónica, se respeta la etapa que mandó el CRM en
  // vez de descartar el negocio.
  let stage = event.stageInCrm ?? null
  if (event.action === 'won' && validStages.has(CIERRE_STAGE)) {
    stage = CIERRE_STAGE
  }

  if (!stage || !validStages.has(stage)) {
    throw new SkipError(
      stage
        ? `Stage "${stage}" is not a valid ProspectPro stage for this user — configure stage_map in Integraciones`
        : 'No stage provided — configure stage_field in Integraciones'
    )
  }

  let status: 'abierto' | 'ganado' | 'perdido' = 'abierto'
  if (event.action === 'won')  status = 'ganado'
  if (event.action === 'lost') status = 'perdido'

  const { data: existing } = await service
    .from('pipeline_simple')
    .select('id')
    .eq('external_id', event.externalId)
    .eq('integration_source', event.source)
    .eq('user_id', targetUserId)
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
        // Si el negocio estaba marcado como eliminado en el CRM y vuelve a
        // aparecer, se reactiva en vez de quedar oculto para siempre.
        deleted_at:    null,
        updated_at:    new Date().toISOString(),
      })
      .eq('id', existing.id)
    if (error) throw new Error(`DB update failed: ${error.message}`)
    const amtLabel = event.amountUsd != null ? ` | $${event.amountUsd}` : ' | sin monto'
    return { action: 'updated', message: `${event.source}:${event.externalId} → ${stage} / ${status}${amtLabel}` }
  }

  const { error } = await service
    .from('pipeline_simple')
    .insert({
      user_id:            targetUserId,
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
  const amtLabel = event.amountUsd != null ? ` | $${event.amountUsd}` : ' | sin monto'
  return { action: 'created', message: `${event.source}:${event.externalId} → ${stage} / ${status}${amtLabel}` }
}
