/**
 * Carga de la conexión de HubSpot de una empresa, con el token ya descifrado.
 * Lo comparten las rutas /pipelines, /owners, /mapping y /sync, y el cron.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { decryptSecret } from '@/lib/utils/crypto'
import type { HubspotConnection } from '@/lib/types/database'

/** Conexión + token en claro. El token NUNCA sale hacia el frontend. */
export interface LoadedConnection {
  connection: HubspotConnection
  token: string
}

/** No hay conexión guardada para esa empresa. */
export class NoConnectionError extends Error {
  constructor() {
    super('Todavía no has conectado HubSpot.')
    this.name = 'NoConnectionError'
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function loadConnection(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  companyName: string,
): Promise<LoadedConnection> {
  const { data } = await service
    .from('hubspot_connections')
    .select('*')
    .eq('company_name', companyName)
    .maybeSingle()

  if (!data) throw new NoConnectionError()

  const token = await decryptSecret(data.private_app_token as string)
  return { connection: data as HubspotConnection, token }
}

/** Marca la conexión como rota, con un mensaje en español para la UI. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function markConnectionError(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  service: SupabaseClient<any>,
  companyName: string,
  message: string,
): Promise<void> {
  await service
    .from('hubspot_connections')
    .update({ sync_status: 'error', last_sync_error: message })
    .eq('company_name', companyName)
}
