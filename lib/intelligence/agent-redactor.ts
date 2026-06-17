import Anthropic from '@anthropic-ai/sdk'
import type { DiagnosticoOutput } from './agent-diagnostico'
import type { PrediccionOutput } from './agent-prediccion'
import type { ActivityEffectivenessItem } from '@/lib/utils/coach-context'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface RedactorConfig {
  tone: string
  maxTokens: number
  extraInstructions: string
}

// Métricas deterministas (calculadas por el motor, no por la IA). La IA las NARRA,
// el motor las inyecta al report_content para que los números sean exactos.
export interface CitasMetricsInput { requeridas: number; reales: number; proyectadas: number; alcanza: boolean }
export interface ChannelItemInput { canal: string; conversion: number; cierre: number }
export interface ChannelsInput { fortalezas: ChannelItemInput[]; debilidades: ChannelItemInput[] }

const TONE_INSTRUCTIONS: Record<string, string> = {
  profesional:  'Mantén un tono profesional, preciso y orientado a negocios.',
  motivacional: 'Mantén un tono motivacional, energizante y orientado a la acción.',
  'analítico':  'Mantén un tono analítico, detallado y basado en datos concretos.',
  directo:      'Sé directo y conciso. Ve al punto sin rodeos.',
  amigable:     'Mantén un tono cercano, empático y conversacional.',
}

function buildPrompt(base: string, config?: RedactorConfig): string {
  if (!config) return base
  const parts = [base]
  const toneInstruction = TONE_INSTRUCTIONS[config.tone]
  if (toneInstruction) parts.push(`[TONO]: ${toneInstruction}`)
  if (config.extraInstructions) parts.push(`INSTRUCCIONES ADICIONALES:\n${config.extraInstructions}`)
  return parts.join('\n\n')
}

export interface RedactorInput {
  userName: string
  periodLabel: string
  period_status: 'en_curso' | 'cerrado'
  dias_habiles_restantes: number
  dias_habiles_totales: number
  diagnostico: DiagnosticoOutput
  prediccion: PrediccionOutput
  citas: CitasMetricsInput
  channels: ChannelsInput
  activityEffectiveness?: ActivityEffectivenessItem[]
}

export interface ReportContent {
  resumen_ejecutivo: string
  analisis_canales: string
  senales_pipeline: string[]
  diagnostico_narrativo: string
  prediccion_narrativa: string
  acciones_prioritarias: { accion: string; impacto: 'alto' | 'medio' | 'bajo'; plazo: string }[]
  cumplimiento_resumen: string
  alerta: string | null
  mensaje_motivacional: string
  // Inyectados por el motor (no por la IA):
  citas?: CitasMetricsInput
  canales?: ChannelsInput
}

const SYSTEM_PROMPT = `RESPONDE ÚNICAMENTE CON EL JSON PURO. Sin texto antes. Sin texto después. Sin markdown. Si agregas cualquier texto fuera del JSON el sistema falla.

Eres un coach comercial experto. Redacta el reporte del vendedor con esta JERARQUÍA, de lo más importante a lo menos. El encabezado debe poder leerse en 10 segundos:

1) CITAS Y META (lo primero): ¿el vendedor va a conseguir las CITAS REQUERIDAS para llegar a la meta? Usa los números del input "citas" (requeridas, reales, proyectadas, alcanza) y la proyección al cierre. Esto va en resumen_ejecutivo.
2) ANÁLISIS POR CANAL (PROTAGONISTA): usa "channels" (fortalezas y debilidades, cada una con su % de conversión a cita y a cierre) y "activityEffectiveness". Explica qué canales son la fortaleza real (mejor convierten actividad en citas y cierres) y cuáles la debilidad (se invierte esfuerzo pero no producen citas). Cierra SIEMPRE con una recomendación accionable: en qué canal enfocar más esfuerzo y cuántas actividades de ese canal hacen falta para cerrar la brecha de citas (proyectadas vs requeridas). Esto va en analisis_canales.
3) SEÑALES DE PIPELINE: oportunidades estancadas, propuestas sin avance/decisión, concentración en etapas tempranas y cuánto dinero está realmente cerca de cerrar. Usa el pipeline del diagnóstico. Va en senales_pipeline (array de 2 a 4 frases cortas, cada una un dato concreto).
4) CUMPLIMIENTO DE ACTIVIDADES (SOPORTE, no protagonista): UNA sola frase de respaldo. NUNCA muestres porcentajes inflados como 1200% u 800%; si una actividad supera su meta dilo como "en meta"/"sobre meta" y nunca escribas un % mayor a 100%. Va en cumplimiento_resumen.

El JSON debe tener EXACTAMENTE esta estructura:
{
  "resumen_ejecutivo": string,
  "analisis_canales": string,
  "senales_pipeline": [string],
  "diagnostico_narrativo": string,
  "prediccion_narrativa": string,
  "acciones_prioritarias": [{"accion": string, "impacto": "alto"|"medio"|"bajo", "plazo": string}],
  "cumplimiento_resumen": string,
  "alerta": string | null,
  "mensaje_motivacional": string
}

REGLA CRÍTICA — ESTADO DEL PERÍODO:
- Si period_status = 'en_curso': PRESENTE. Menciona dias_habiles_restantes en resumen_ejecutivo o prediccion_narrativa. acciones_prioritarias ejecutables en el tiempo que queda.
- Si period_status = 'cerrado': PASADO. Es un resultado final, no un plan. acciones_prioritarias se vuelven aprendizajes para el próximo período (plazo = "Próximo período"). prediccion_narrativa describe el resultado final.
- NUNCA mezcles el tono.

Reglas:
- resumen_ejecutivo: 2-3 oraciones liderando con citas proyectadas vs requeridas y si alcanza la meta.
- analisis_canales: 3-5 oraciones; fortalezas, debilidades y la recomendación con número concreto de actividades del canal correcto.
- senales_pipeline: array de 2-4 frases cortas con números reales del pipeline.
- diagnostico_narrativo y prediccion_narrativa: breves, de apoyo (2-3 oraciones).
- acciones_prioritarias: exactamente 3, ordenadas por impacto.
- cumplimiento_resumen: 1 oración, cumplimiento como soporte, sin % mayor a 100.
- alerta: null si va bien; 1 oración si hay riesgo crítico.
- mensaje_motivacional: 1 oración con el nombre del vendedor.
- Específico con números reales del input. Español. SOLO el JSON puro.`

export interface ReportGerenteContent {
  resumen_ejecutivo: string
  diagnostico_equipo: string
  analisis_canales: string
  senales_pipeline: string[]
  ranking_rendimiento: { posicion: number; nombre: string; compliance: number; estado: 'en_riesgo' | 'en_camino' | 'destacado' }[]
  alertas_individuales: { nombre: string; alerta: string; accion: string }[]
  prediccion_narrativa: string
  acciones_gestion: { accion: string; prioridad: 'alta' | 'media' | 'baja'; deadline: string }[]
  mensaje_gerente: string
  // Inyectados por el motor (no por la IA):
  citas?: CitasMetricsInput
  canales?: ChannelsInput
}

export interface RedactorGerenteInput {
  managerName: string
  periodLabel: string
  period_status: 'en_curso' | 'cerrado'
  dias_habiles_restantes: number
  dias_habiles_totales: number
  diagnostico: import('./agent-diagnostico').DiagnosticoGerenteOutput
  prediccion: import('./agent-prediccion').PrediccionGerenteOutput
  citas: CitasMetricsInput
  channels: ChannelsInput
  members: { userName: string; overall_compliance: number }[]
}

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  if (fenced) return fenced[1].trim()
  // Find the outermost {...} block even if model adds text before/after
  const obj = raw.match(/\{[\s\S]*\}/)
  return obj ? obj[0].trim() : raw.trim()
}

export async function runAgentRedactor(input: RedactorInput, config?: RedactorConfig): Promise<ReportContent> {
  const maxAttempts = 2
  let lastRaw = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: config?.maxTokens ?? 2048,
      system: buildPrompt(SYSTEM_PROMPT, config),
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    })
    lastRaw = response.content[0].type === 'text' ? response.content[0].text : ''
    try {
      return JSON.parse(extractJSON(lastRaw)) as ReportContent
    } catch {
      console.error(`[agent-redactor] JSON parse failed (attempt ${attempt}/${maxAttempts}). Raw:`, lastRaw)
    }
  }
  throw new Error('agent-redactor returned invalid JSON')
}

const GERENTE_SYSTEM_PROMPT = `RESPONDE ÚNICAMENTE CON EL JSON PURO. Sin texto antes. Sin texto después. Sin markdown. Si agregas cualquier texto fuera del JSON el sistema falla.

Eres un coach ejecutivo de ventas. Redacta el reporte del equipo para que el gerente o CEO entienda el estado en 10 segundos, sin consolidar nada manualmente. Sigue esta JERARQUÍA, de lo más importante a lo menos:

1) CITAS Y META DEL EQUIPO (lo primero): ¿el equipo va a conseguir las CITAS REQUERIDAS para llegar a la meta? Usa "citas" (requeridas, reales, proyectadas, alcanza) y la proyección al cierre. Resume también quién necesita atención y por qué. Va en resumen_ejecutivo.
2) ANÁLISIS POR CANAL (PROTAGONISTA): usa "channels" (fortalezas y debilidades del equipo, con % de conversión a cita y a cierre). Di qué canales son la fortaleza del equipo y cuáles la debilidad (esfuerzo sin citas). Cierra con una recomendación clara: en qué canal debe enfocarse el equipo para cerrar la brecha de citas. Va en analisis_canales.
3) SEÑALES DE PIPELINE: dinero cerca de cerrar, oportunidades estancadas, concentración en etapas tempranas a nivel equipo. Va en senales_pipeline (array de 2 a 4 frases cortas con números reales).
4) CUMPLIMIENTO (SOPORTE): el ranking y las alertas individuales quedan como respaldo. NUNCA escribas porcentajes mayores a 100%.

El JSON debe tener EXACTAMENTE esta estructura:
{
  "resumen_ejecutivo": string,
  "diagnostico_equipo": string,
  "analisis_canales": string,
  "senales_pipeline": [string],
  "ranking_rendimiento": [{"posicion": number, "nombre": string, "compliance": number, "estado": "en_riesgo"|"en_camino"|"destacado"}],
  "alertas_individuales": [{"nombre": string, "alerta": string, "accion": string}],
  "prediccion_narrativa": string,
  "acciones_gestion": [{"accion": string, "prioridad": "alta"|"media"|"baja", "deadline": string}],
  "mensaje_gerente": string
}

REGLA CRÍTICA — ESTADO DEL PERÍODO:
- Si period_status = 'en_curso': PRESENTE. Menciona dias_habiles_restantes. acciones_gestion ejecutables en el tiempo que queda.
- Si period_status = 'cerrado': PASADO, resultado final. acciones_gestion para el PRÓXIMO período (deadline = "Próximo período").

Reglas:
- resumen_ejecutivo: 2-3 oraciones liderando con citas del equipo proyectadas vs requeridas, proyección y quién necesita atención.
- diagnostico_equipo: 2-3 oraciones de apoyo con datos.
- analisis_canales: 3-5 oraciones; fortalezas, debilidades y recomendación de canal.
- senales_pipeline: array de 2-4 frases con números reales.
- ranking_rendimiento: TODOS los miembros, mejor a peor; destacado >= 80, en_camino 50-79, en_riesgo < 50. compliance nunca mayor a 100.
- alertas_individuales: solo compliance < 70%, máximo 3, con acción.
- acciones_gestion: exactamente 3.
- mensaje_gerente: 1 oración con el nombre del gerente.
- Español. SOLO el JSON puro.`

export async function runAgentRedactorGerente(input: RedactorGerenteInput, config?: RedactorConfig): Promise<ReportGerenteContent> {
  const maxAttempts = 2
  let lastRaw = ''
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: config?.maxTokens ?? 2048,
      system: buildPrompt(GERENTE_SYSTEM_PROMPT, config),
      messages: [{ role: 'user', content: JSON.stringify(input) }],
    })
    lastRaw = response.content[0].type === 'text' ? response.content[0].text : ''
    try {
      return JSON.parse(extractJSON(lastRaw)) as ReportGerenteContent
    } catch {
      console.error(`[agent-redactor-gerente] JSON parse failed (attempt ${attempt}/${maxAttempts}). Raw:`, lastRaw)
    }
  }
  throw new Error('agent-redactor-gerente returned invalid JSON')
}
