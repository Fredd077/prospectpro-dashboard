import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/**
 * Identificador estable de empresa usado por TODA la infraestructura de
 * integraciones (integrations.company_name, integration_api_keys, webhook_logs,
 * hubspot_connections).
 *
 * No existe una tabla `companies`: la empresa es profiles.company, texto libre.
 * Esta función vivía duplicada dentro de lib/actions/integrations.ts; se extrajo
 * aquí para que el flujo de HubSpot agrupe EXACTAMENTE igual y no se creen dos
 * "empresas" distintas para el mismo usuario.
 */
export function resolveCompany(
  profile: { company?: string | null },
  userEmail: string | undefined,
  userId: string,
): string {
  if (profile.company) return profile.company
  if (userEmail) return userEmail
  return userId
}

/**
 * Resuelve el segmento [company] de una URL de webhook a su company_name real.
 * Primero intenta el slug opaco (integrations.webhook_slug — esquema nuevo,
 * URL-safe pase lo que pase con el nombre de la empresa). Si no hay fila con
 * ese slug, cae al esquema viejo (el nombre de empresa URL-encodeado
 * directamente en la ruta), para no romper un webhook que un cliente ya
 * tenga configurado en su CRM con la URL anterior.
 */
export async function resolveCompanyFromRouteParam(
  service: SupabaseClient<Database>,
  routeParam: string,
): Promise<string> {
  const { data } = await service
    .from('integrations')
    .select('company_name')
    .eq('webhook_slug', routeParam)
    .maybeSingle()
  if (data?.company_name) return data.company_name
  return decodeURIComponent(routeParam)
}
