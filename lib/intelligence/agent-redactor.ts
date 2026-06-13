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
  activityEffectiveness?: ActivityEffectivenessItem[]
}

export interface ReportContent {
  resumen_ejecutivo: string
  diagnostico_narrativo: string
  prediccion_narrativa: string
  acciones_prioritarias: { accion: string; impacto: 'alto' | 'medio' | 'bajo'; plazo: string }[]
  alerta: string | null
  efectividad_canales: string | null
  mensaje_motivacional: string
}

const SYSTEM_PROMPT = `RESPONDE ÚNICAMENTE CON EL JSON PURO. Sin texto antes. Sin texto después. Sin markdown. Si agregas cualquier texto fuera del JSON el sistema falla.

Eres un coach comercial experto. Redacta el reporte de rendimiento del vendedor de forma clara y directa.

El JSON debe tener exactamente esta estructura:
{
  "resumen_ejecutivo": string,
  "diagnostico_narrativo": string,
  "prediccion_narrativa": string,
  "acciones_prioritarias": [{"accion": string, "impacto": "alto"|"medio"|"bajo", "plazo": string}],
  "alerta": string | null,
  "efectividad_canales": string | null,
  "mensaje_motivacional": string
}

REGLA CRÍTICA — ESTADO DEL PERÍODO (leer antes de redactar):
- Si period_status = 'en_curso': Redacta TODO en PRESENTE. El período sigue abierto. Menciona explícitamente los días hábiles restantes (dias_habiles_restantes) en el resumen o prediccion_narrativa. Las acciones_prioritarias deben ser ejecutables dentro del tiempo que queda. Usa frases como "Llevas X de Y", "Te quedan N días hábiles para...", "Este período cierra en...".
- Si period_status = 'cerrado': Redacta TODO en PASADO. Este es un reporte de resultado final, NO un plan. acciones_prioritarias se convierte en aprendizajes o ajustes para el SIGUIENTE período — NUNCA acciones ejecutables en el período cerrado. prediccion_narrativa describe el resultado final que ocurrió. Usa frases como "El período cerró con...", "Abril terminó en...", "Para el próximo período, considera...". El campo "plazo" en acciones debe decir "Próximo período".
- NUNCA mezcles el tono: no uses presente si cerrado, no uses pasado si en_curso.

Reglas generales:
- resumen_ejecutivo: 2-3 oraciones con los números más importantes del período
- diagnostico_narrativo: párrafo de 3-4 oraciones describiendo qué pasó y por qué con datos específicos
- prediccion_narrativa: si en_curso → proyección al cierre con días restantes; si cerrado → evaluación del resultado final
- acciones_prioritarias: exactamente 3, ordenadas de mayor a menor impacto
- alerta: null si el negocio va bien; 1 oración de alerta si hay riesgo crítico
- efectividad_canales: si el input incluye activityEffectiveness con al menos 2 actividades con executions > 0, genera este texto exacto (usa saltos de línea \\n dentro del string JSON). Distingue dos problemas distintos: conversión a CITA (conversionToMeeting) y conversión a CIERRE (closeProbability). Un canal puede agendar bien pero cerrar mal, o viceversa:
  "EFECTIVIDAD DE CANALES\\n[Canal con mayor conversión a cita]: [X]% a cita — [observación de 1 línea]\\n[Canal con menor conversión a cita]: [Y]% a cita — [qué mejorar para agendar más]\\n[Canal con menor conversión a cierre]: [Z]% a cierre (closeProbability) — agenda pero no cierra, [qué mejorar para cerrar]\\nRecomendación: [una acción concreta para el canal débil en cita y otra para el débil en cierre, orientadas a alcanzar la meta]"
  Si no hay datos de activityEffectiveness: null
- mensaje_motivacional: 1 oración personalizada con el nombre del vendedor y datos reales
- Específico con números, nunca genérico ni vago
- Responde en español
- NO incluyas markdown, SOLO el JSON puro
- El tono aplica al ESTILO de redacción dentro de los campos de texto, nunca para agregar texto fuera del JSON`

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
  period_status: 'en_curso' | 'cerrado'
  dias_habiles_restantes: number
  dias_habiles_totales: number
  diagnostico: import('./agent-diagnostico').DiagnosticoGerenteOutput
  prediccion: import('./agent-prediccion').PrediccionGerenteOutput
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

Eres un coach ejecutivo de ventas. Redacta el reporte del equipo para el gerente de forma clara y accionable.

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

REGLA CRÍTICA — ESTADO DEL PERÍODO:
- Si period_status = 'en_curso': Redacta en PRESENTE. Menciona los días hábiles restantes (dias_habiles_restantes) en el resumen o prediccion_narrativa. acciones_gestion deben ser ejecutables en el tiempo que queda, con deadlines concretos dentro del período.
- Si period_status = 'cerrado': Redacta en PASADO. acciones_gestion se convierte en acciones para el PRÓXIMO período — NUNCA para el período cerrado. prediccion_narrativa describe el resultado final real. El deadline en acciones debe decir "Próximo período" o la próxima semana/mes según corresponda.

Reglas generales:
- resumen_ejecutivo: 2-3 oraciones con los KPIs del equipo y números reales
- diagnostico_equipo: 3-4 oraciones sobre el estado del equipo con datos específicos
- ranking_rendimiento: TODOS los miembros, ordenados de mejor a peor; destacado >= 80%, en_camino 50-79%, en_riesgo < 50%
- alertas_individuales: solo compliance < 70%, máximo 3; con alerta concreta y acción
- prediccion_narrativa: en_curso → proyección al cierre; cerrado → resultado final
- acciones_gestion: exactamente 3 acciones de gestión
- mensaje_gerente: 1 oración motivadora con nombre del gerente y datos reales
- Responde en español
- SOLO el JSON puro
- El tono aplica al ESTILO de redacción dentro de los campos de texto, nunca para agregar texto fuera del JSON`

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
