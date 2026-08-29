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
export const CANONICAL_PIPELINE_STAGES = [
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
export type PipelineStageRole = 'cita' | 'reagendar' | 'reunion' | 'propuesta' | 'cierre'

export const PIPELINE_STAGE_ROLE_LABELS: Record<PipelineStageRole, string> = {
  cita:      'Cita',
  reagendar: 'Reagendar',
  reunion:   'Reunión',
  propuesta: 'Propuesta',
  cierre:    'Cierre',
}

/** Rol por defecto de cada etapa canónica — usado al sembrarlas por primera vez. */
export const CANONICAL_STAGE_ROLES: Record<string, PipelineStageRole> = {
  'Cita agendada':                                  'cita',
  'Reagendar':                                       'reagendar',
  'Primera reu ejecutada/Propuesta en preparación':  'reunion',
  'Propuesta Presentada':                            'propuesta',
  'Por facturar/cobrar':                             'cierre',
}
