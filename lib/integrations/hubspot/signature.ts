/**
 * Verificación de que una petición entrante viene realmente de HubSpot.
 *
 * HubSpot firma cada webhook con el CLIENT SECRET de la App Privada. Hay tres
 * versiones vivas y se soportan todas, prefiriendo la más fuerte:
 *
 *   v3 — cabecera `X-HubSpot-Signature-v3`
 *        HMAC-SHA256( secret , method + uri + body + timestamp ) en Base64.
 *        Incluye timestamp, así que también protege contra replay.
 *   v2 — cabecera `X-HubSpot-Signature` con `X-HubSpot-Signature-Version: v2`
 *        SHA256( secret + method + uri + body ) en hexadecimal.
 *   v1 — cabecera `X-HubSpot-Signature` con versión v1
 *        SHA256( secret + body ) en hexadecimal.
 *
 * Las comparaciones son de tiempo constante para no filtrar información por
 * temporización.
 */

/** Ventana máxima de antigüedad para v3: HubSpot indica rechazar >5 minutos. */
const MAX_TIMESTAMP_AGE_MS = 5 * 60 * 1000

export type SignatureResult =
  | { valid: true; version: 'v1' | 'v2' | 'v3' }
  | { valid: false; reason: string }

function toHex(bytes: ArrayBuffer): string {
  return Array.from(new Uint8Array(bytes))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

function toBase64(bytes: ArrayBuffer): string {
  const arr = new Uint8Array(bytes)
  let bin = ''
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i])
  return btoa(bin)
}

function utf8(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text)
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength))
  out.set(encoded)
  return out
}

/** Comparación de tiempo constante: no corta al primer byte distinto. */
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

async function sha256Hex(input: string): Promise<string> {
  return toHex(await crypto.subtle.digest('SHA-256', utf8(input)))
}

async function hmacSha256Base64(secret: string, input: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    utf8(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return toBase64(await crypto.subtle.sign('HMAC', key, utf8(input)))
}

/**
 * Reconstruye la URI tal como la llamó HubSpot. Detrás del proxy de Vercel,
 * req.url puede traer el host interno, así que se arma desde las cabeceras
 * reenviadas: la v2 y la v3 firman la URI exacta y cualquier diferencia
 * (protocolo, host, orden de query) invalida la firma.
 */
export function reconstructRequestUri(req: Request): string {
  const url = new URL(req.url)
  const proto = req.headers.get('x-forwarded-proto') ?? url.protocol.replace(':', '')
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host') ?? url.host
  return `${proto}://${host}${url.pathname}${url.search}`
}

export async function verifyHubSpotSignature(
  req: Request,
  rawBody: string,
  clientSecret: string,
): Promise<SignatureResult> {
  const uri = reconstructRequestUri(req)
  const method = req.method.toUpperCase()

  // ── v3 (preferida) ────────────────────────────────────────────────────────
  const v3 = req.headers.get('x-hubspot-signature-v3')
  if (v3) {
    const ts = req.headers.get('x-hubspot-request-timestamp')
    if (!ts) return { valid: false, reason: 'Falta la cabecera de timestamp (v3).' }

    const age = Date.now() - Number(ts)
    if (!Number.isFinite(age)) return { valid: false, reason: 'Timestamp inválido (v3).' }
    if (age > MAX_TIMESTAMP_AGE_MS) {
      return { valid: false, reason: 'La petición tiene más de 5 minutos; se descarta por seguridad.' }
    }

    const expected = await hmacSha256Base64(clientSecret, `${method}${uri}${rawBody}${ts}`)
    return timingSafeEqual(expected, v3)
      ? { valid: true, version: 'v3' }
      : { valid: false, reason: 'La firma v3 no coincide.' }
  }

  // ── v1 / v2 ───────────────────────────────────────────────────────────────
  const legacy = req.headers.get('x-hubspot-signature')
  if (!legacy) return { valid: false, reason: 'La petición no trae firma de HubSpot.' }

  const version = req.headers.get('x-hubspot-signature-version') ?? 'v1'

  if (version === 'v2') {
    const expected = await sha256Hex(`${clientSecret}${method}${uri}${rawBody}`)
    return timingSafeEqual(expected, legacy)
      ? { valid: true, version: 'v2' }
      : { valid: false, reason: 'La firma v2 no coincide.' }
  }

  const expected = await sha256Hex(`${clientSecret}${rawBody}`)
  return timingSafeEqual(expected, legacy)
    ? { valid: true, version: 'v1' }
    : { valid: false, reason: 'La firma v1 no coincide.' }
}
