/**
 * Cliente de la API de HubSpot — ÚNICO lugar del proyecto que llama a
 * api.hubapi.com. Autenticación por Private App Token (`pat-...`).
 *
 * El token de una app privada no expira solo: únicamente deja de servir si el
 * admin lo revoca o regenera en HubSpot. Por eso NO hay lógica de refresh; solo
 * se traduce el 401/403 a un error tipado para pedir reconexión.
 */

const HUBSPOT_API = 'https://api.hubapi.com'

/** Scopes que la guía en pantalla le pide activar al admin de HubSpot. */
export const REQUIRED_SCOPES = [
  'crm.objects.deals.read',
  'crm.objects.owners.read',
  'crm.schemas.deals.read',
] as const

/** Token inválido, revocado o sin los permisos necesarios (401 / 403). */
export class HubSpotAuthError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'HubSpotAuthError'
  }
}

/** Cualquier otro fallo de la API (red, 5xx, límite de tasa). */
export class HubSpotApiError extends Error {
  readonly status: number
  constructor(message: string, status: number) {
    super(message)
    this.name = 'HubSpotApiError'
    this.status = status
  }
}

async function hsFetch<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  let res: Response
  try {
    res = await fetch(`${HUBSPOT_API}${path}`, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...(init?.headers ?? {}),
      },
      cache: 'no-store',
    })
  } catch {
    throw new HubSpotApiError('No se pudo conectar con HubSpot. Revisa tu conexión e inténtalo de nuevo.', 0)
  }

  if (res.status === 401) {
    throw new HubSpotAuthError(
      'HubSpot rechazó el token. Puede haber sido revocado o regenerado: crea uno nuevo y vuelve a conectarlo.',
    )
  }
  if (res.status === 403) {
    throw new HubSpotAuthError(
      'El token es válido pero le faltan permisos. Revisa que en el paso 5 hayas activado los scopes de lectura de negocios, propietarios y esquemas.',
    )
  }
  if (res.status === 429) {
    throw new HubSpotApiError('HubSpot está limitando las peticiones. Espera un momento y reintenta.', 429)
  }
  if (!res.ok) {
    throw new HubSpotApiError(`HubSpot respondió con un error (${res.status}).`, res.status)
  }

  return res.json() as Promise<T>
}

// ── Pipelines y etapas ──────────────────────────────────────────────────────

export interface HubSpotStage {
  id: string
  label: string
  displayOrder: number
  /** Etapa terminal del pipeline (ganada o perdida). */
  isClosed: boolean
  /** 1 = ganada, 0 = perdida. Solo significativo si isClosed. */
  probability: number
}

export interface HubSpotPipeline {
  id: string
  label: string
  displayOrder: number
  stages: HubSpotStage[]
}

interface RawStage {
  id: string
  label: string
  displayOrder: number
  metadata?: { isClosed?: string; probability?: string }
}

interface RawPipeline {
  id: string
  label: string
  displayOrder: number
  stages: RawStage[]
}

function normalizePipeline(p: RawPipeline): HubSpotPipeline {
  return {
    id: p.id,
    label: p.label,
    displayOrder: p.displayOrder,
    stages: (p.stages ?? [])
      .map((s) => ({
        id: s.id,
        label: s.label,
        displayOrder: s.displayOrder,
        isClosed: s.metadata?.isClosed === 'true',
        probability: Number(s.metadata?.probability ?? 0),
      }))
      .sort((a, b) => a.displayOrder - b.displayOrder),
  }
}

/** Pipelines de negocios con sus etapas reales (nombre visible, no el slug interno). */
export async function fetchDealPipelines(token: string): Promise<HubSpotPipeline[]> {
  const data = await hsFetch<{ results: RawPipeline[] }>(token, '/crm/v3/pipelines/deals')
  return (data.results ?? []).map(normalizePipeline).sort((a, b) => a.displayOrder - b.displayOrder)
}

/**
 * Valida el token contra la API real antes de guardarlo.
 * Usa el endpoint de pipelines porque ejercita el scope crm.schemas.deals.read
 * y de paso devuelve lo que necesita la pantalla de mapeo.
 */
export async function validateToken(token: string): Promise<HubSpotPipeline[]> {
  const trimmed = token.trim()
  if (!trimmed) throw new HubSpotAuthError('Pega el token de acceso antes de conectar.')
  if (!trimmed.startsWith('pat-')) {
    throw new HubSpotAuthError(
      'Ese no parece un token de app privada. Debe empezar con "pat-" (paso 7 de la guía).',
    )
  }
  return fetchDealPipelines(trimmed)
}

// ── Cuenta ──────────────────────────────────────────────────────────────────

export interface HubSpotAccount {
  hubId: string | null
  hubDomain: string | null
}

/**
 * Datos del portal. Best-effort: /account-info/v3/details exige un scope que la
 * guía NO pide, así que un fallo aquí no debe romper la conexión.
 */
export async function fetchAccountInfo(token: string): Promise<HubSpotAccount> {
  try {
    const data = await hsFetch<{ portalId?: number; uiDomain?: string }>(token, '/account-info/v3/details')
    return {
      hubId: data.portalId != null ? String(data.portalId) : null,
      hubDomain: data.uiDomain ?? null,
    }
  } catch {
    return { hubId: null, hubDomain: null }
  }
}

// ── Owners ──────────────────────────────────────────────────────────────────

export interface HubSpotOwner {
  id: string
  email: string | null
  firstName: string | null
  lastName: string | null
}

export async function fetchOwners(token: string): Promise<HubSpotOwner[]> {
  const out: HubSpotOwner[] = []
  let after: string | undefined

  do {
    const qs = new URLSearchParams({ limit: '100' })
    if (after) qs.set('after', after)
    const data = await hsFetch<{
      results: { id: string; email?: string; firstName?: string; lastName?: string }[]
      paging?: { next?: { after?: string } }
    }>(token, `/crm/v3/owners?${qs.toString()}`)

    for (const o of data.results ?? []) {
      out.push({
        id: o.id,
        email: o.email ?? null,
        firstName: o.firstName ?? null,
        lastName: o.lastName ?? null,
      })
    }
    after = data.paging?.next?.after
  } while (after)

  return out
}

// ── Deals ───────────────────────────────────────────────────────────────────

export interface HubSpotDeal {
  id: string
  name: string | null
  amount: number | null
  stageId: string | null
  pipelineId: string | null
  ownerId: string | null
  lastModified: string | null
}

const DEAL_PROPERTIES = [
  'dealname',
  'amount',
  'dealstage',
  'pipeline',
  'hubspot_owner_id',
  'hs_lastmodifieddate',
]

/**
 * Un negocio por ID. Lo usa el webhook en tiempo real: el evento solo trae
 * objectId (y, en propertyChange, la propiedad que cambió), así que se relee el
 * negocio completo para que webhook y cron escriban exactamente los mismos datos.
 * Devuelve null si el negocio ya no existe (404).
 */
export async function fetchDealById(token: string, dealId: string): Promise<HubSpotDeal | null> {
  const qs = new URLSearchParams({ properties: DEAL_PROPERTIES.join(',') })
  try {
    const d = await hsFetch<{ id: string; properties: Record<string, string | null> }>(
      token,
      `/crm/v3/objects/deals/${encodeURIComponent(dealId)}?${qs.toString()}`,
    )
    const p = d.properties ?? {}
    const rawAmount = p.amount != null ? Number(p.amount) : NaN
    return {
      id: d.id,
      name: p.dealname ?? null,
      amount: Number.isFinite(rawAmount) ? rawAmount : null,
      stageId: p.dealstage ?? null,
      pipelineId: p.pipeline ?? null,
      ownerId: p.hubspot_owner_id ?? null,
      lastModified: p.hs_lastmodifieddate ?? null,
    }
  } catch (err) {
    if (err instanceof HubSpotApiError && err.status === 404) return null
    throw err
  }
}

/**
 * Negocios modificados desde `sinceIso`. Pagina hasta agotar resultados o
 * alcanzar `maxPages` (freno de seguridad para no colgar un cron).
 */
export async function searchDealsModifiedSince(
  token: string,
  sinceIso: string,
  pipelineId?: string | null,
  maxPages = 20,
): Promise<HubSpotDeal[]> {
  const out: HubSpotDeal[] = []
  let after: string | undefined
  let pages = 0

  do {
    const filters: Record<string, string>[] = [
      { propertyName: 'hs_lastmodifieddate', operator: 'GTE', value: String(new Date(sinceIso).getTime()) },
    ]
    if (pipelineId) filters.push({ propertyName: 'pipeline', operator: 'EQ', value: pipelineId })

    const body: Record<string, unknown> = {
      filterGroups: [{ filters }],
      properties: DEAL_PROPERTIES,
      limit: 100,
      sorts: [{ propertyName: 'hs_lastmodifieddate', direction: 'ASCENDING' }],
    }
    if (after) body.after = after

    const data = await hsFetch<{
      results: { id: string; properties: Record<string, string | null> }[]
      paging?: { next?: { after?: string } }
    }>(token, '/crm/v3/objects/deals/search', { method: 'POST', body: JSON.stringify(body) })

    for (const d of data.results ?? []) {
      const p = d.properties ?? {}
      const rawAmount = p.amount != null ? Number(p.amount) : NaN
      out.push({
        id: d.id,
        name: p.dealname ?? null,
        amount: Number.isFinite(rawAmount) ? rawAmount : null,
        stageId: p.dealstage ?? null,
        pipelineId: p.pipeline ?? null,
        ownerId: p.hubspot_owner_id ?? null,
        lastModified: p.hs_lastmodifieddate ?? null,
      })
    }

    after = data.paging?.next?.after
    pages++
  } while (after && pages < maxPages)

  return out
}
