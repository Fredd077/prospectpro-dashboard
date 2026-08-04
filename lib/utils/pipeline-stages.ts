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
