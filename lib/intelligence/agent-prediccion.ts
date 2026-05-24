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
