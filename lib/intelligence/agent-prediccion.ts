import Anthropic from '@anthropic-ai/sdk'
import type { DiagnosticoOutput } from './agent-diagnostico'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface PrediccionInput {
  diagnostico: DiagnosticoOutput
  periodType: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  daysElapsed: number
  totalDaysInPeriod: number
  monthly_goal: number
  closed_amount: number
  open_amount: number
  avg_ticket: number
}

export interface PrediccionOutput {
  tendencia: 'positiva' | 'negativa' | 'estable'
  ingreso_proyectado: number
  probabilidad_meta_pct: number
  brecha_meta: number
  actividades_criticas: string[]
  escenario_optimista: string
  escenario_pesimista: string
}

const SYSTEM_PROMPT = `Eres un analista de predicción comercial. Basándote en el diagnóstico y los datos del período, proyecta el resultado esperado y devuelve ÚNICAMENTE un JSON válido sin markdown.

El JSON debe tener exactamente esta estructura:
{
  "tendencia": "positiva"|"negativa"|"estable",
  "ingreso_proyectado": number,
  "probabilidad_meta_pct": number,
  "brecha_meta": number,
  "actividades_criticas": string[],
  "escenario_optimista": string,
  "escenario_pesimista": string
}

Reglas:
- tendencia: basada en cumplimiento actual y ritmo vs meta
- ingreso_proyectado: extrapolación lineal del ingreso_cerrado al cierre del mes completo
- probabilidad_meta_pct: 0-100, qué tan probable es alcanzar la meta mensual con el ritmo actual
- brecha_meta: monthly_goal - ingreso_proyectado (positivo = falta dinero, negativo = la supera)
- actividades_criticas: 2-3 acciones específicas y medibles que más impactarían el resultado
- escenarios: 1 oración cada uno describiendo el mejor y peor caso realista con números
- Responde en español
- NO incluyas markdown, SOLO el JSON puro`

export interface PrediccionGerenteInput {
  diagnostico: import('./agent-diagnostico').DiagnosticoGerenteOutput
  periodType: 'daily' | 'weekly' | 'monthly'
  monthly_goal_total: number
  closed_amount_total: number
  open_amount_total: number
  daysElapsed: number
  totalDaysInPeriod: number
  teamSize: number
}

export interface PrediccionGerenteOutput {
  tendencia_equipo: 'positiva' | 'negativa' | 'estable'
  ingreso_proyectado_equipo: number
  probabilidad_meta_equipo_pct: number
  miembros_necesitan_intervencion: { nombre: string; accion_recomendada: string }[]
  riesgo_principal: string
  escenario_optimista: string
  escenario_pesimista: string
}

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

export async function runAgentPrediccion(input: PrediccionInput): Promise<PrediccionOutput> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(extractJSON(raw)) as PrediccionOutput
  } catch {
    console.error('[agent-prediccion] JSON parse failed. Raw response:', raw)
    throw new Error('agent-prediccion returned invalid JSON')
  }
}

const GERENTE_SYSTEM_PROMPT = `Eres un analista predictivo de equipos comerciales. Proyecta el resultado del equipo y devuelve ÚNICAMENTE un JSON válido sin markdown.

El JSON debe tener exactamente esta estructura:
{
  "tendencia_equipo": "positiva"|"negativa"|"estable",
  "ingreso_proyectado_equipo": number,
  "probabilidad_meta_equipo_pct": number,
  "miembros_necesitan_intervencion": [{"nombre": string, "accion_recomendada": string}],
  "riesgo_principal": string,
  "escenario_optimista": string,
  "escenario_pesimista": string
}

Reglas:
- tendencia_equipo: basada en cumplimiento promedio y ritmo actual vs meta del equipo
- ingreso_proyectado_equipo: extrapolación lineal del cierre del equipo al mes completo
- probabilidad_meta_equipo_pct: 0-100, qué tan probable que el equipo alcance su meta agregada
- miembros_necesitan_intervencion: máximo 3, los que más impactan el riesgo del equipo
- riesgo_principal: el mayor riesgo del equipo en 1 oración con número concreto
- escenarios: 1 oración cada uno con números reales
- Responde en español
- SOLO el JSON puro`

export async function runAgentPrediccionGerente(input: PrediccionGerenteInput): Promise<PrediccionGerenteOutput> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: GERENTE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(extractJSON(raw)) as PrediccionGerenteOutput
  } catch {
    console.error('[agent-prediccion-gerente] JSON parse failed. Raw:', raw)
    throw new Error('agent-prediccion-gerente returned invalid JSON')
  }
}
