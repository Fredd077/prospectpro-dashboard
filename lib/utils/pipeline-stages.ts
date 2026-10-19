/**
 * Etapas canónicas del Pipeline — definición ÚNICA compartida.
 *
 * Se usa en dos lugares que deben coincidir exactamente (nombre y orden):
 *  - PipelineSimpleBoard: respaldo visual del tablero cuando el usuario todavía
 *    no tiene etapas propias en pipeline_stages.
 *  - getPipelineStages (lib/actions/pipeline-stages.ts): siembra estas 5 la
 *    primera vez que un usuario sin etapas abre el gestor.
 *
 * No puede vivir en lib/actions/pipeline-stages.ts: ese archivo es 'use server'
 * y solo puede exportar funciones async.
 */
import type { SalesPosition } from '@/lib/calculations/recipe'

export const CANONICAL_PIPELINE_STAGES = [
  'Contactado',
  'Cita agendada',
  'Reagendar',
  'Primera reu ejecutada/Propuesta en preparación',
  'Propuesta Presentada',
  'Por facturar/cobrar',
] as const

/**
 * Rol semántico de una etapa — identifica qué representa en el embudo
 * (para las tarjetas de resumen y el auto-marcado de estado) de forma
 * ESTABLE frente a renombres. A diferencia del nombre, un rename de
 * `pipeline_stages.name` nunca lo toca: solo cambia si el usuario lo
 * reasigna explícitamente desde el gestor de etapas.
 *
 * `null` = etapa personalizada sin rol asignado: no participa en ninguna
 * tarjeta de resumen hasta que el usuario le asigne uno.
 */
export type PipelineStageRole = 'contacto' | 'cita' | 'reagendar' | 'reunion' | 'propuesta' | 'cierre'

export const PIPELINE_STAGE_ROLE_LABELS: Record<PipelineStageRole, string> = {
  contacto:  'Contacto',
  cita:      'Cita',
  reagendar: 'Reagendar',
  reunion:   'Reunión',
  propuesta: 'Propuesta',
  cierre:    'Cierre',
}

/** Rol por defecto de cada etapa canónica — usado al sembrarlas por primera vez. */
export const CANONICAL_STAGE_ROLES: Record<string, PipelineStageRole> = {
  'Contactado':                                      'contacto',
  'Cita agendada':                                  'cita',
  'Reagendar':                                       'reagendar',
  'Primera reu ejecutada/Propuesta en preparación':  'reunion',
  'Propuesta Presentada':                            'propuesta',
  'Por facturar/cobrar':                             'cierre',
}

/** Nombre canónico de cada rol — inverso de CANONICAL_STAGE_ROLES. */
const CANONICAL_NAME_BY_ROLE = Object.fromEntries(
  Object.entries(CANONICAL_STAGE_ROLES).map(([name, role]) => [role, name]),
) as Record<PipelineStageRole, string>

/**
 * Nombre de etapa que tiene cada rol HOY, según cómo el usuario la haya
 * llamado. Fuente única compartida por cualquier pantalla que necesite
 * identificar "la etapa de cierre" etc. sin depender del texto exacto (ver
 * PipelineStageRole arriba). Si `stages` viene vacío (usuario sin etapas
 * propias todavía), usa el respaldo canónico.
 */
export function buildStageNameByRole(
  stages: { name: string; role: PipelineStageRole | null }[],
): Partial<Record<PipelineStageRole, string>> {
  if (!stages.length) return { ...CANONICAL_NAME_BY_ROLE }
  const map: Partial<Record<PipelineStageRole, string>> = {}
  for (const s of stages) if (s.role) map[s.role] = s.name
  return map
}

/**
 * Inverso de buildStageNameByRole: para UN usuario, nombre de etapa -> rol.
 * Útil cuando hay que recorrer filas de pipeline_simple y preguntar "¿esta
 * etapa es la de cierre?" en vez de "¿cuál etapa tiene el rol cierre?". Con
 * respaldo canónico si el usuario no tiene etapas propias todavía.
 */
export function buildRoleByStageName(
  stages: { name: string; role: PipelineStageRole | null }[],
): Record<string, PipelineStageRole | null | undefined> {
  return stages.length > 0
    ? Object.fromEntries(stages.map((s) => [s.name, s.role]))
    : CANONICAL_STAGE_ROLES
}

// ── Vista por cargo (BDR/SDR vs Closer) — ver migración 046 ────────────────
// Roles de etapa que le toca TRABAJAR a cada cargo en el Pipeline. La etapa
// de traspaso ('reunion') queda en ambos lados a propósito: el BDR/SDR
// necesita confirmar que la reunión se ejecutó (show rate) y el Closer la
// recibe desde ahí — misma idea que stageRangeForPosition en el Recetario,
// aplicada aquí a roles de etapa en vez de índices.
const PIPELINE_ROLES_BY_SALES_POSITION: Record<'bdr_sdr' | 'closer', PipelineStageRole[]> = {
  bdr_sdr: ['contacto', 'cita', 'reagendar', 'reunion'],
  closer:  ['reunion', 'propuesta', 'cierre'],
}

/**
 * Filtra las etapas del Pipeline que le corresponden al cargo del usuario.
 * Las etapas sin rol asignado (personalizadas sin configurar) NUNCA se
 * ocultan — no hay forma de clasificarlas, y ocultarlas escondería negocios
 * reales del usuario sin que lo note (mismo criterio que UnassignedStageAlert).
 *
 * 'full_cycle' o sin cargo definido = todas las etapas, sin filtrar — el
 * comportamiento de siempre para cualquier cuenta que no haya elegido cargo.
 */
export function filterStagesForPosition<T extends { name: string; role: PipelineStageRole | null }>(
  stages: T[],
  salesPosition: SalesPosition,
): T[] {
  if (salesPosition !== 'bdr_sdr' && salesPosition !== 'closer') return stages
  const allowed = PIPELINE_ROLES_BY_SALES_POSITION[salesPosition]
  const visible = stages.filter((s) => s.role === null || allowed.includes(s.role))
  // Salvaguarda: si el filtro dejara la lista vacía (ej. usuario asignó TODOS
  // sus roles al cargo contrario), se degrada a mostrar todo en vez de un
  // Pipeline sin columnas.
  return visible.length > 0 ? visible : stages
}
