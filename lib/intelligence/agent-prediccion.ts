import Anthropic from '@anthropic-ai/sdk'
import type { DiagnosticoOutput } from './agent-diagnostico'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface PrediccionInput {
  diagnostico: DiagnosticoOutput
  periodType: 'daily' | 'weekly' | 'monthly'
  periodStart: string
  periodEnd: string
  period_status: 'en_curso' | 'cerrado'
  daysElapsed: number
  totalDaysInPeriod: number
  dias_habiles_transcurridos: number
  dias_habiles_restantes: number
  dias_habiles_totales: number
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

const SYSTEM_PROMPT = `Eres un analista de predicción comercial. Basándote en el diagnóstico y los datos del período, evalúa o proyecta el resultado y devuelve ÚNICAMENTE un JSON válido sin markdown.

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

REGLA CRÍTICA — ESTADO DEL PERÍODO:
- Si period_status = 'en_curso': el período sigue abierto. Usa dias_habiles_restantes para proyectar el cierre realista. ingreso_proyectado es extrapolación lineal al cierre del período completo. Las actividades_criticas son acciones ejecutables en los días hábiles que quedan.
- Si period_status = 'cerrado': el período ya terminó. NO proyectes — evalúa el resultado final definitivo. ingreso_proyectado = ingreso cerrado real (sin extrapolación). probabilidad_meta_pct refleja si se alcanzó la meta (100 = superó, 0-49 = no alcanzó). actividades_criticas deben ser aprendizajes para el siguiente período, no acciones futuras. Los escenarios describen lo que ocurrió realmente.

Reglas generales:
- tendencia: basada en cumplimiento actual y ritmo vs meta
- brecha_meta: monthly_goal - ingreso_proyectado (positivo = falta, negativo = superó)
- Responde en español
- NO incluyas markdown, SOLO el JSON puro`

export interface PrediccionGerenteInput {
  diagnostico: import('./agent-diagnostico').DiagnosticoGerenteOutput
  periodType: 'daily' | 'weekly' | 'monthly'
  period_status: 'en_curso' | 'cerrado'
  monthly_goal_total: number
  closed_amount_total: number
  open_amount_total: number
  daysElapsed: number
  totalDaysInPeriod: number
  dias_habiles_transcurridos: number
  dias_habiles_restantes: number
  dias_habiles_totales: number
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

const GERENTE_SYSTEM_PROMPT = `Eres un analista predictivo de equipos comerciales. Evalúa o proyecta el resultado del equipo y devuelve ÚNICAMENTE un JSON válido sin markdown.

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

REGLA CRÍTICA — ESTADO DEL PERÍODO:
- Si period_status = 'en_curso': proyecta el cierre del equipo usando dias_habiles_restantes. Las intervenciones de miembros son acciones ejecutables en el tiempo restante.
- Si period_status = 'cerrado': evalúa el resultado final real del equipo. ingreso_proyectado_equipo = cierre real. miembros_necesitan_intervencion describe qué aprender de cada miembro para el próximo período.

Reglas generales:
- tendencia_equipo: basada en cumplimiento promedio y ritmo actual vs meta
- probabilidad_meta_equipo_pct: 0-100
- riesgo_principal: 1 oración con número concreto
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
