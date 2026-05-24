import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface DiagnosticoInput {
  userName: string
  periodLabel: string
  recipe: {
    name: string
    monthly_goal: number
    avg_ticket: number
    outbound_pct: number
  } | null
  activities: {
    name: string
    type: string
    goal: number
    real: number
    compliance_pct: number
  }[]
  pipeline: {
    open_amount: number
    closed_amount: number
    won_count: number
    lost_count: number
    by_stage: { stage: string; count: number; amount: number }[]
  }
  overall_compliance: number
}

export interface DiagnosticoOutput {
  compliance_pct: number
  income_vs_goal_pct: number
  fortalezas: string[]
  areas_de_mejora: string[]
  actividades_clave: { nombre: string; cumplimiento: number; impacto: 'alto' | 'medio' | 'bajo' }[]
  pipeline_resumen: string
  nivel_urgencia: 'alto' | 'medio' | 'bajo'
}

const SYSTEM_PROMPT = `Eres un analista de rendimiento comercial. Analiza los datos del vendedor y devuelve ÚNICAMENTE un JSON válido sin markdown, sin texto adicional.

El JSON debe tener exactamente esta estructura:
{
  "compliance_pct": number,
  "income_vs_goal_pct": number,
  "fortalezas": string[],
  "areas_de_mejora": string[],
  "actividades_clave": [{"nombre": string, "cumplimiento": number, "impacto": "alto"|"medio"|"bajo"}],
  "pipeline_resumen": string,
  "nivel_urgencia": "alto"|"medio"|"bajo"
}

Reglas:
- compliance_pct: cumplimiento general de actividades del período
- income_vs_goal_pct: % del ingreso cerrado vs meta mensual (0 si no hay datos de meta)
- fortalezas: 2-3 items concretos con números reales de los datos
- areas_de_mejora: 2-3 items concretos con acciones específicas
- actividades_clave: las 2-3 actividades con mayor impacto en el resultado
- pipeline_resumen: 1 oración sobre el estado actual del pipeline
- nivel_urgencia: alto si compliance < 50%, medio si 50-80%, bajo si > 80%
- Responde en español
- NO incluyas markdown, NO incluyas \`\`\`json, SOLO el JSON puro`

export async function runAgentDiagnostico(input: DiagnosticoInput): Promise<DiagnosticoOutput> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })

  const text = response.content[0].type === 'text' ? response.content[0].text.trim() : '{}'
  return JSON.parse(text) as DiagnosticoOutput
}
