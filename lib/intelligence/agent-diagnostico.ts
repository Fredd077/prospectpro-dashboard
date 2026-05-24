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

export interface DiagnosticoGerenteInput {
  managerName: string
  periodLabel: string
  teamSize: number
  members: {
    userName: string
    overall_compliance: number
    activities: { name: string; type: string; goal: number; real: number; compliance_pct: number }[]
    pipeline: { open_amount: number; closed_amount: number; won_count: number; lost_count: number }
  }[]
  teamAggregates: {
    avg_compliance: number
    total_closed_amount: number
    total_open_amount: number
    members_at_risk: number
    members_on_track: number
    monthly_goal_total: number
  }
}

export interface DiagnosticoGerenteOutput {
  avg_compliance_pct: number
  at_risk_members: { nombre: string; compliance: number; motivo: string }[]
  fortalezas_equipo: string[]
  debilidades_equipo: string[]
  patron_fallo_comun: string
  nivel_urgencia: 'alto' | 'medio' | 'bajo'
}

function extractJSON(raw: string): string {
  const fenced = raw.match(/```(?:json)?\s*([\s\S]*?)\s*```/)
  return fenced ? fenced[1].trim() : raw.trim()
}

export async function runAgentDiagnostico(input: DiagnosticoInput): Promise<DiagnosticoOutput> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })

  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(extractJSON(raw)) as DiagnosticoOutput
  } catch {
    console.error('[agent-diagnostico] JSON parse failed. Raw response:', raw)
    throw new Error('agent-diagnostico returned invalid JSON')
  }
}

const GERENTE_SYSTEM_PROMPT = `Eres un analista de rendimiento de equipos comerciales. Analiza los datos del equipo y devuelve ÚNICAMENTE un JSON válido sin markdown.

El JSON debe tener exactamente esta estructura:
{
  "avg_compliance_pct": number,
  "at_risk_members": [{"nombre": string, "compliance": number, "motivo": string}],
  "fortalezas_equipo": string[],
  "debilidades_equipo": string[],
  "patron_fallo_comun": string,
  "nivel_urgencia": "alto"|"medio"|"bajo"
}

Reglas:
- avg_compliance_pct: cumplimiento promedio del equipo en el período
- at_risk_members: miembros con cumplimiento < 70%, con motivo específico basado en datos reales
- fortalezas_equipo: 2-3 fortalezas del equipo con números reales
- debilidades_equipo: 2-3 debilidades con acciones concretas
- patron_fallo_comun: actividad o comportamiento donde más miembros fallan simultáneamente
- nivel_urgencia: alto si avg_compliance < 50%, medio si 50-75%, bajo si > 75%
- Responde en español
- NO incluyas markdown, SOLO el JSON puro`

export async function runAgentDiagnosticoGerente(input: DiagnosticoGerenteInput): Promise<DiagnosticoGerenteOutput> {
  const response = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1500,
    system: GERENTE_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: JSON.stringify(input) }],
  })
  const raw = response.content[0].type === 'text' ? response.content[0].text : ''
  try {
    return JSON.parse(extractJSON(raw)) as DiagnosticoGerenteOutput
  } catch {
    console.error('[agent-diagnostico-gerente] JSON parse failed. Raw:', raw)
    throw new Error('agent-diagnostico-gerente returned invalid JSON')
  }
}
