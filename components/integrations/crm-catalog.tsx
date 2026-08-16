/**
 * Catálogo de CRMs del selector visual.
 *
 * Logos: solo se usan marcas cuyo SVG oficial publica Simple Icons (CC0). Al
 * momento de escribir esto, de los siete CRMs de la lista Simple Icons solo
 * conserva HubSpot y Zoho —el resto fueron retirados del paquete—, así que esos
 * dos llevan su logo real y los demás una insignia de iniciales con el color de
 * marca. Nunca se dibuja un logotipo inventado.
 *
 * Los dos paths están incrustados (en vez de depender del paquete completo)
 * porque serían la única razón para arrastrar esa dependencia.
 * Fuente: simple-icons, licencia CC0 1.0.
 */
import { Plug } from 'lucide-react'

export interface CrmDef {
  /** Valor que se guarda en integrations.crm_name. */
  id: string
  label: string
  /** Color de marca, para el logo o la insignia. */
  hex: string
  /** Path SVG oficial (24×24) si existe; si no, se usa insignia de iniciales. */
  path?: string
  /** true = flujo nativo; false = webhook genérico. */
  native?: boolean
}

const HUBSPOT_PATH =
  'M18.164 7.93V5.084a2.198 2.198 0 001.267-1.978v-.067A2.2 2.2 0 0017.238.845h-.067a2.2 2.2 0 00-2.193 2.193v.067a2.196 2.196 0 001.252 1.973l.013.006v2.852a6.22 6.22 0 00-2.969 1.31l.012-.01-7.828-6.095A2.497 2.497 0 104.3 4.656l-.012.006 7.697 5.991a6.176 6.176 0 00-1.038 3.446c0 1.343.425 2.588 1.147 3.607l-.013-.02-2.342 2.343a1.968 1.968 0 00-.58-.095h-.002a2.033 2.033 0 102.033 2.033 1.978 1.978 0 00-.1-.595l.005.014 2.317-2.317a6.247 6.247 0 104.782-11.134l-.036-.005zm-.964 9.378a3.206 3.206 0 113.215-3.207v.002a3.206 3.206 0 01-3.207 3.207z'

const ZOHO_PATH =
  'M8.66 6.897a1.299 1.299 0 0 0-1.205.765l-.642 1.44-.062-.385A1.291 1.291 0 0 0 5.27 7.648l-4.185.678A1.291 1.291 0 0 0 .016 9.807l.678 4.18a1.293 1.293 0 0 0 1.27 1.087c.074 0 .143-.01.216-.017l4.18-.678c.436-.07.784-.351.96-.723l2.933 1.307a1.304 1.304 0 0 0 .988.026c.321-.12.575-.365.716-.678l.28-.629.038.276a1.297 1.297 0 0 0 1.455 1.103l3.712-.501a1.29 1.29 0 0 0 1.03.514h4.236c.713 0 1.29-.58 1.291-1.291V9.545c0-.712-.58-1.291-1.291-1.291h-4.236c-.079 0-.155.008-.23.022a1.309 1.309 0 0 0-.275-.288c-.275-.21-.614-.3-.958-.253l-4.197.571c-.155.021-.3.07-.432.14L9.159 7.01a1.27 1.27 0 0 0-.499-.113zm-.025.705c.077 0 .159.013.24.052l2.971 1.324c-.128.238-.18.508-.142.782l.357 2.596h.002l-.745 1.672a.59.59 0 0 1-.777.296l-3.107-1.385-.004-.041-.41-2.526L8.1 7.95a.589.589 0 0 1 .536-.348zm-3.159.733c.125 0 .245.039.343.112.13.09.21.227.237.382l.234 1.446-.56 1.259a1.27 1.27 0 0 0-.026.987c.12.322.364.575.678.717l.295.131a.585.585 0 0 1-.428.314l-4.185.678a.59.59 0 0 1-.674-.485l-.678-4.18a.588.588 0 0 1 .485-.674l4.185-.678c.03-.004.064-.01.094-.01zm11.705.09a.59.59 0 0 1 .415.173 1.287 1.287 0 0 0-.416.947v4.237c0 .033.003.065.005.097l-3.55.482a.586.586 0 0 1-.66-.502l-.191-1.403.899-2.017a1.29 1.29 0 0 0-.333-1.5l3.754-.51c.026-.004.051-.004.077-.004zm1.3.532h4.227c.326 0 .588.266.588.588v4.237a.589.589 0 0 1-.588.588h-4.237a.564.564 0 0 1-.12-.013c.47-.246.758-.765.684-1.318zm-5.988.309.254.113c.296.133.43.48.296.777l-.432.97-.207-1.465a.58.58 0 0 1 .09-.395zm5.39.538.453 3.325a.583.583 0 0 1-.453.65zM6.496 11.545l.17 1.052a.588.588 0 0 1-.293-.776z'

export const CRM_CATALOG: CrmDef[] = [
  { id: 'HubSpot',    label: 'HubSpot',    hex: '#FF7A59', path: HUBSPOT_PATH, native: true },
  { id: 'Salesforce', label: 'Salesforce', hex: '#00A1E0' },
  { id: 'Pipedrive',  label: 'Pipedrive',  hex: '#017737' },
  { id: 'Zoho CRM',   label: 'Zoho CRM',   hex: '#E42527', path: ZOHO_PATH },
  { id: 'monday.com', label: 'monday.com', hex: '#FF3D57' },
  { id: 'Close',      label: 'Close',      hex: '#3B82F6' },
  { id: 'Freshsales', label: 'Freshsales', hex: '#F97316' },
]


/**
 * Reconoce un crm_name ya guardado y lo asocia a una tarjeta del catálogo.
 *
 * Importa porque el campo era ANTES un input de texto libre: hay empresas en
 * producción con 'Pipedrive' escrito a mano. Sin esta normalización, el día que
 * se publique el selector verían la pantalla en blanco y su integración —que
 * sigue funcionando— parecería rota.
 *
 * Compara sin distinguir mayúsculas ni espacios, y acepta alias comunes.
 */
const ALIASES: Record<string, string> = {
  hubspot: 'HubSpot',
  'hub spot': 'HubSpot',
  salesforce: 'Salesforce',
  sfdc: 'Salesforce',
  pipedrive: 'Pipedrive',
  zoho: 'Zoho CRM',
  'zoho crm': 'Zoho CRM',
  monday: 'monday.com',
  'monday.com': 'monday.com',
  mondaycom: 'monday.com',
  close: 'Close',
  'close.com': 'Close',
  'close.io': 'Close',
  freshsales: 'Freshsales',
  freshworks: 'Freshsales',
}

export function matchCrm(stored: string | null | undefined): CrmDef | null {
  if (!stored) return null
  const key = stored.trim().toLowerCase()
  if (!key) return null
  const canonical = ALIASES[key]
  if (canonical) return CRM_CATALOG.find((c) => c.id === canonical) ?? null
  return CRM_CATALOG.find((c) => c.id.toLowerCase() === key || c.label.toLowerCase() === key) ?? null
}

/** Identificador del comodín; el nombre real lo escribe el usuario. */
export const OTHER_CRM_ID = '__other__'

function initials(label: string): string {
  const clean = label.replace(/[^A-Za-z]/g, '')
  return (clean.slice(0, 2) || '??').toUpperCase()
}

export function CrmLogo({ crm, size = 28 }: { crm: CrmDef | null; size?: number }) {
  if (!crm) {
    return <Plug className="text-muted-foreground/60" style={{ width: size, height: size }} />
  }
  if (crm.path) {
    return (
      <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={crm.hex} aria-label={crm.label}>
        <path d={crm.path} />
      </svg>
    )
  }
  // Sin logo oficial disponible: insignia de iniciales con el color de marca.
  return (
    <span
      aria-label={crm.label}
      className="inline-flex items-center justify-center rounded-md font-bold"
      style={{
        width: size, height: size,
        backgroundColor: `${crm.hex}1A`,
        color: crm.hex,
        border: `1px solid ${crm.hex}40`,
        fontSize: size * 0.4,
      }}
    >
      {initials(crm.label)}
    </span>
  )
}
