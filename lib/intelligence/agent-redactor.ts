import Anthropic from '@anthropic-ai/sdk'
import type { DiagnosticoOutput } from './agent-diagnostico'
import type { PrediccionOutput } from './agent-prediccion'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

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

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

export async function runAgentRedactor(input: RedactorInput): Promise<ReportContent> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
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
