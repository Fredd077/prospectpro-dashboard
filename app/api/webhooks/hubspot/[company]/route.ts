/**
 * Webhook en tiempo real de HubSpot (suscripciones de App Privada).
 *
 * Ruta por empresa —igual que /api/webhooks/inbound/[company]— porque cada
 * cliente crea su propia App Privada y pega SU URL. Así no dependemos de tener
 * el portalId guardado (fetchAccountInfo es best-effort).
 *
 * Seguridad: cada petición se verifica con la firma que HubSpot calcula con el
 * client secret de la app (v3, o v1/v2 como respaldo). Sin firma válida se
 * responde 401 y no se toca la base — mismo nivel de protección que la API key
 * del webhook genérico.
 *
 * El evento solo trae objectId, así que se relee el negocio completo desde la
 * API y se aplica con la MISMA función que usa el cron (applyDealToPipeline).
 */
import { NextResponse, after } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { decryptSecret } from '@/lib/utils/crypto'
import { verifyHubSpotSignature } from '@/lib/integrations/hubspot/signature'
import { fetchDealById, fetchDealPipelines } from '@/lib/integrations/hubspot/client'
import { applyDealToPipeline, buildStageMeta } from '@/lib/integrations/hubspot/sync'

export const dynamic = 'force-dynamic'
export const maxDuration = 60

/** Suscripciones que nos interesan; el resto se ignora sin ruido. */
const DEAL_EVENTS = new Set([
  'deal.creation',
  'deal.propertyChange',
  'deal.deletion',
  'deal.merge',
])

interface HubSpotEvent {
  eventId?: number
  subscriptionType?: string
  objectId?: number | string
  portalId?: number
  propertyName?: string
  occurredAt?: number
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'ProspectPro — HubSpot webhook' })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ company: string }> },
) {
  const { company } = await params
  const companyName = decodeURIComponent(company)
  const service = getSupabaseServiceClient()

  // El cuerpo crudo es imprescindible: la firma se calcula sobre el texto exacto.
  const rawBody = await request.text()

  const { data: conn } = await service
    .from('hubspot_connections')
    .select('*')
    .eq('company_name', companyName)
    .maybeSingle()

  if (!conn) {
    return NextResponse.json({ error: 'Conexión no encontrada' }, { status: 404 })
  }
  if (!conn.client_secret) {
    return NextResponse.json(
      { error: 'Esta conexión aún no tiene configurado el secreto de webhooks.' },
      { status: 409 },
    )
  }

  // ── Verificación de origen ────────────────────────────────────────────────
  let secret: string
  try {
    secret = await decryptSecret(conn.client_secret as string)
  } catch {
    return NextResponse.json({ error: 'No se pudo leer el secreto de la conexión.' }, { status: 500 })
  }

  const check = await verifyHubSpotSignature(request, rawBody, secret)
  if (!check.valid) {
    console.warn('[webhooks/hubspot]', companyName, 'firma rechazada:', check.reason)
    return NextResponse.json({ error: 'Firma inválida' }, { status: 401 })
  }

  let events: HubSpotEvent[] = []
  try {
    const parsed = JSON.parse(rawBody)
    events = Array.isArray(parsed) ? parsed : [parsed]
  } catch {
    return NextResponse.json({ error: 'Cuerpo inválido' }, { status: 400 })
  }

  // Se responde 200 de inmediato (HubSpot reintenta si tardamos) y el trabajo
  // real corre en after(), que Vercel sí garantiza que termina.
  after(async () => {
    const now = new Date().toISOString()
    try {
      const token = await decryptSecret(conn.private_app_token as string)
      const stageMapping = (conn.stage_mapping ?? {}) as Record<string, string>
      const ownerMapping = (conn.owner_mapping ?? {}) as Record<string, string>
      const fallbackUserId = conn.connected_by_user_id as string

      // Un mismo negocio puede venir en varios eventos del mismo lote: se
      // deduplica para leerlo una sola vez de la API.
      const dealIds = new Set<string>()
      const deletedIds = new Set<string>()
      for (const ev of events) {
        if (!ev.subscriptionType || !DEAL_EVENTS.has(ev.subscriptionType)) continue
        if (ev.objectId == null) continue
        const id = String(ev.objectId)
        if (ev.subscriptionType === 'deal.deletion') deletedIds.add(id)
        else dealIds.add(id)
      }

      // Borrados: NO se elimina la fila. Se marca con deleted_at para que salga
      // de la vista activa y de las métricas, conservando el historial.
      for (const id of deletedIds) {
        dealIds.delete(id)
        await service
          .from('pipeline_simple')
          .update({ deleted_at: now })
          .eq('external_id', id)
          .eq('integration_source', 'hubspot')
          .is('deleted_at', null)
      }

      if (dealIds.size > 0) {
        if (Object.keys(stageMapping).length === 0) {
          console.warn('[webhooks/hubspot]', companyName, 'sin stage_mapping; eventos ignorados')
        } else {
          const stageMeta = buildStageMeta(await fetchDealPipelines(token))

          for (const id of dealIds) {
            try {
              const deal = await fetchDealById(token, id)
              if (!deal) continue
              await applyDealToPipeline(service, {
                deal, stageMapping, ownerMapping, stageMeta, fallbackUserId,
              })
            } catch (err) {
              console.error('[webhooks/hubspot]', companyName, 'deal', id, err)
            }
          }
        }
      }

      await service
        .from('hubspot_connections')
        .update({ last_webhook_at: now, sync_status: 'active', last_sync_error: null })
        .eq('company_name', companyName)
    } catch (err) {
      console.error('[webhooks/hubspot]', companyName, err)
      await service
        .from('hubspot_connections')
        .update({
          sync_status: 'error',
          last_sync_error: 'Falló el procesamiento de un webhook de HubSpot. Revisa que el token siga siendo válido.',
        })
        .eq('company_name', companyName)
    }
  })

  return NextResponse.json({ ok: true, received: events.length })
}
