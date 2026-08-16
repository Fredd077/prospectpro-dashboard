/**
 * Guía paso a paso para crear la App Privada en HubSpot.
 *
 * Vive como dato (no incrustada en el JSX) porque se muestra en dos sitios: al
 * conectar por primera vez y en el banner de "tu conexión dejó de funcionar".
 * Está escrita para alguien SIN perfil técnico: nada de slugs internos ni jerga.
 */

export interface GuideStep {
  /** Texto del paso. `**negrita**` marca lo que el usuario ve en HubSpot. */
  text: string
  /** Detalle secundario opcional. */
  hint?: string
}

export const HUBSPOT_SETUP_STEPS: GuideStep[] = [
  { text: 'En HubSpot, ve a **Configuración** (el ícono de engranaje, arriba a la derecha).' },
  { text: 'En el menú de la izquierda, busca **Integraciones → Apps privadas**.' },
  { text: 'Haz clic en **"Crear una app privada"**.' },
  { text: 'En la pestaña **"Información básica"**, ponle de nombre `ProspectPro`.' },
  {
    text: 'Ve a la pestaña **"Scopes"** y activa (buscándolos en el buscador de permisos): `crm.objects.deals.read`, `crm.objects.owners.read`, `crm.schemas.deals.read`.',
    hint: 'Si quieres que también traigamos el nombre de la empresa asociada al negocio, activa además `crm.objects.contacts.read`.',
  },
  { text: 'Haz clic en **"Crear app"** (arriba a la derecha) y confirma.' },
  {
    text: 'HubSpot te muestra un **Token de acceso** que empieza con `pat-`. Haz clic en **"Mostrar token"** y cópialo.',
  },
  {
    text: 'Vuelve aquí, pega el token en el campo de abajo y haz clic en **"Conectar"**.',
  },
]

/**
 * Pasos adicionales para la sincronización en tiempo real. Se muestran DESPUÉS
 * de conectar, porque la URL del webhook solo existe una vez creada la conexión.
 */
export const HUBSPOT_WEBHOOK_STEPS: GuideStep[] = [
  {
    text: 'En tu app privada de HubSpot, abre la pestaña **"Auth"** y, en **Client secret**, haz clic en **"Mostrar secreto"** y cópialo.',
    hint: 'Es distinto del token: sirve para que ProspectPro compruebe que los avisos vienen de verdad de HubSpot.',
  },
  {
    text: 'Pega ese secreto en el campo **"Client secret"** de abajo y guarda.',
  },
  {
    text: 'En la misma app privada, abre la pestaña **"Webhooks"** y haz clic en **"Crear suscripción"**.',
  },
  {
    text: 'En **"URL de destino"**, pega la dirección que ProspectPro te muestra abajo.',
  },
  {
    text: 'Crea suscripciones para el objeto **Negocio (Deal)**: **Creado**, **Eliminado** y **Cambio de propiedad** sobre las propiedades `dealstage`, `amount` y `dealname`.',
    hint: '`dealstage` es la más importante: es la que avisa cuando un negocio cambia de etapa.',
  },
  {
    text: 'Activa las suscripciones (**"Activar"**) y guarda los cambios de la app.',
  },
]

/** URL que el usuario debe pegar en HubSpot, construida por empresa. */
export function buildWebhookUrl(baseUrl: string, companyName: string): string {
  const clean = baseUrl.replace(/\/+$/, '')
  return `${clean}/api/webhooks/hubspot/${encodeURIComponent(companyName)}`
}
