export async function hashKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key)
  const buffer = await crypto.subtle.digest('SHA-256', encoded)
  return Array.from(new Uint8Array(buffer))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

// ══════════════════════════════════════════════════════════════════════════
// Cifrado simétrico reversible (AES-256-GCM) para secretos que hay que poder
// volver a leer — hoy: el Private App Token de HubSpot.
//
// hashKey() de arriba es unidireccional y sirve para VERIFICAR una API key
// entrante; no sirve aquí, porque necesitamos recuperar el token para llamar a
// la API de HubSpot. Se usa Web Crypto (no node:crypto) para que funcione igual
// en runtime Node y Edge, como el resto de este archivo.
// ══════════════════════════════════════════════════════════════════════════

const ENC_VERSION = 'v1'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('')
}

// Se respaldan explícitamente en un ArrayBuffer: los tipos modernos de TS hacen
// Uint8Array genérico sobre su buffer, y Web Crypto exige ArrayBuffer (no
// SharedArrayBuffer), así que un Uint8Array<ArrayBufferLike> no es asignable.
function fromHex(hex: string): Uint8Array<ArrayBuffer> {
  const out = new Uint8Array(new ArrayBuffer(hex.length / 2))
  for (let i = 0; i < out.length; i++) out[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  return out
}

function toBytes(text: string): Uint8Array<ArrayBuffer> {
  const encoded = new TextEncoder().encode(text)
  const out = new Uint8Array(new ArrayBuffer(encoded.byteLength))
  out.set(encoded)
  return out
}

async function importAesKey(): Promise<CryptoKey> {
  const hex = process.env.HUBSPOT_TOKEN_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'Falta la variable de entorno HUBSPOT_TOKEN_ENCRYPTION_KEY. Genérala con: openssl rand -hex 32',
    )
  }
  if (!/^[0-9a-fA-F]{64}$/.test(hex)) {
    throw new Error(
      'HUBSPOT_TOKEN_ENCRYPTION_KEY debe ser exactamente 64 caracteres hexadecimales (32 bytes). Genérala con: openssl rand -hex 32',
    )
  }
  return crypto.subtle.importKey('raw', fromHex(hex), { name: 'AES-GCM' }, false, ['encrypt', 'decrypt'])
}

/** Cifra un secreto. Devuelve `v1:<iv_hex>:<ciphertext_hex>` (el tag GCM va dentro del ciphertext). */
export async function encryptSecret(plaintext: string): Promise<string> {
  const key = await importAesKey()
  const iv = crypto.getRandomValues(new Uint8Array(new ArrayBuffer(12)))
  const buf = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    toBytes(plaintext),
  )
  return `${ENC_VERSION}:${toHex(iv)}:${toHex(new Uint8Array(buf))}`
}

/** Descifra un secreto producido por encryptSecret(). */
export async function decryptSecret(payload: string): Promise<string> {
  const parts = payload.split(':')
  if (parts.length !== 3 || parts[0] !== ENC_VERSION) {
    throw new Error('El secreto guardado no tiene un formato reconocible; vuelve a conectar la integración.')
  }
  const [, ivHex, dataHex] = parts
  const key = await importAesKey()
  const plain = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: fromHex(ivHex) },
    key,
    fromHex(dataHex),
  )
  return new TextDecoder().decode(plain)
}

/** Versión enmascarada para mostrar en la UI: `pat-••••••••1a2b`. Nunca el token completo. */
export function maskToken(token: string): string {
  const tail = token.slice(-4)
  const prefix = token.startsWith('pat-') ? 'pat-' : ''
  return `${prefix}••••••••${tail}`
}
