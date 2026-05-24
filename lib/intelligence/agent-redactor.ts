import Anthropic from '@anthropic-ai/sdk'
import type { DiagnosticoOutput } from './agent-diagnostico'
import type { PrediccionOutput } from './agent-prediccion'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface RedactorConfig {
  tone: string
  maxTokens: number
  extraInstructions: string
}

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
  diagnostico: DiagnosticoOutput
  prediccion: PrediccionOutput
}

export interface ReportContent {
  resumen_ejecutivo: string
  diagnostico_narrativo: string
  prediccion_narrativa: string
  acciones_prioritarias: { accion: string; impacto: 'alto' | 'medio' | 'bajo'; plazo: string }[]
  alerta: string | null
  mensaje_motivacional: string
}

const SYSTEM_PROMPT = `Eres un coach comercial experto. Redacta el reporte de rendimiento del vendedor de forma clara, directa y motivadora. Devuelve ÚNICAMENTE un JSON válido sin markdown.

El JSON debe tener exactamente esta estructura:
{
  "resumen_ejecutivo": string,
  "diagnostico_narrativo": string,
  "prediccion_narrativa": string,
  "acciones_prioritarias": [{"accion": string, "impacto": "alto"|"medio"|"bajo", "plazo": string}],
  "alerta": string | null,
  "mensaje_motivacional": string
}

Reglas:
- resumen_ejecutivo: 2-3 oraciones con los números más importantes del período
- diagnostico_narrativo: párrafo de 3-4 oraciones describiendo qué pasó y por qué con datos específicos
- prediccion_narrativa: párrafo de 2-3 oraciones sobre el resultado proyectado si continúa el ritmo actual
- acciones_prioritarias: exactamente 3 acciones concretas y medibles ordenadas de mayor a menor impacto
- alerta: null si el negocio va bien; 1 oración de alerta si hay riesgo crítico (compliance < 50% o probabilidad_meta < 30%)
- mensaje_motivacional: 1 oración energizante y personalizada usando el nombre del vendedor, basada en los datos reales
- Tono: directo, específico con números, nunca genérico ni vago
- Responde en español
- NO incluyas markdown, SOLO el JSON puro`

export interface ReportGerenteContent {
  resumen_ejecutivo: string
  diagnostico_equipo: string
  ranking_rendimiento: { posicion: number; nombre: string; compliance: number; estado: 'en_riesgo' | 'en_camino' | 'destacado' }[]
  alertas_individuales: { nombre: string; alerta: string; accion: string }[]
  prediccion_narrativa: string
  acciones_gestion: { accion: string; prioridad: 'alta' | 'media' | 'baja'; deadline: string }[]
  mensaje_gerente: string
}

export interface RedactorGerenteInput {
  managerName: string
  periodLabel: string
  diagnostico: import('./agent-diagnostico').DiagnosticoGerenteOutput
  prediccion: import('./agent-prediccion').PrediccionGerenteOutput
  members: { userName: string; overall_compliance: number }[]
}

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

export async function runAgentRedactor(input: RedactorInput, config?: RedactorConfig): Promise<ReportContent> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: config?.maxTokens ?? 2048,
    system: buildPrompt(SYSTEM_PROMPT, config),
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(extractJSON(raw)) as ReportContent
  } catch {
    console.error('[agent-redactor] JSON parse failed. Raw response:', raw)
    throw new Error('agent-redactor returned invalid JSON')
  }
}

const GERENTE_SYSTEM_PROMPT = `Eres un coach ejecutivo de ventas. Redacta el reporte del equipo para el gerente de forma clara y accionable. Devuelve ÚNICAMENTE un JSON válido sin markdown.

El JSON debe tener exactamente esta estructura:
{
  "resumen_ejecutivo": string,
  "diagnostico_equipo": string,
  "ranking_rendimiento": [{"posicion": number, "nombre": string, "compliance": number, "estado": "en_riesgo"|"en_camino"|"destacado"}],
  "alertas_individuales": [{"nombre": string, "alerta": string, "accion": string}],
  "prediccion_narrativa": string,
  "acciones_gestion": [{"accion": string, "prioridad": "alta"|"media"|"baja", "deadline": string}],
  "mensaje_gerente": string
}

Reglas:
- resumen_ejecutivo: 2-3 oraciones con los KPIs más importantes del equipo y números reales
- diagnostico_equipo: párrafo de 3-4 oraciones sobre el estado del equipo con datos específicos
- ranking_rendimiento: TODOS los miembros, ordenados de mejor a peor; estado: destacado >= 80%, en_camino 50-79%, en_riesgo < 50%
- alertas_individuales: solo miembros con compliance < 70%, máximo 3; con alerta concreta y acción inmediata
- prediccion_narrativa: 2-3 oraciones sobre el resultado proyectado del equipo
- acciones_gestion: exactamente 3 acciones de gestión con deadline concreto (esta semana, esta quincena, etc.)
- mensaje_gerente: 1 oración motivadora para el gerente personalizada con su nombre y datos reales
- Responde en español
- SOLO el JSON puro`

export async function runAgentRedactorGerente(input: RedactorGerenteInput, config?: RedactorConfig): Promise<ReportGerenteContent> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: config?.maxTokens ?? 2048,
    system: buildPrompt(GERENTE_SYSTEM_PROMPT, config),
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(extractJSON(raw)) as ReportGerenteContent
  } catch {
    console.error('[agent-redactor-gerente] JSON parse failed. Raw:', raw)
    throw new Error('agent-redactor-gerente returned invalid JSON')
  }
}
