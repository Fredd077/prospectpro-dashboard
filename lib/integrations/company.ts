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
