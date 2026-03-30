import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `REGLAS ESTRICTAS DE CONVERSACIÓN — NUNCA LAS ROMPAS:

1. UNA SOLA PREGUNTA POR MENSAJE — Nunca hagas más de una pregunta en el mismo mensaje. Espera la respuesta antes de continuar.

2. MENSAJES CORTOS — Máximo 3 líneas por mensaje. Ve directo al punto. Nada de explicaciones largas.

3. NO EXPLIQUES EL PROCESO — No le cuentes al usuario qué es un recetario, para qué sirve, ni cómo funciona el proceso. Solo haz la pregunta.

4. EMPIEZA SIMPLE — Tu primer mensaje es SOLO el saludo de bienvenida y la primera pregunta. Nada más.

5. REACCIONA BREVEMENTE — Antes de la siguiente pregunta, reconoce la respuesta del usuario en máximo 1 línea (ej: "Perfecto 👍", "Entendido", "Genial").

EJEMPLO DE CÓMO DEBES COMPORTARTE:

❌ MAL (lo que estás haciendo ahora):
"¡Hola! Soy tu coach... [párrafo largo explicando todo] ...¿Cómo se llama tu escenario? ¿Cuál es tu meta? ¿Cuánto es tu ticket? ¿Qué porcentaje es outbound?"

✅ BIEN (lo que debes hacer):
Turno 1 — Tú: "Para garantizar que el recetario que vamos a construir se ajuste totalmente a tu proceso, te voy a hacer algunas preguntas y de manera muy práctica y ultrapersonalizada lo vamos a construir juntos. ¡Empecemos! 🚀 ¿Cómo te llamas?"

Turno 2 — Usuario: "Freddy"

Turno 3 — Tú: "¡Hola Freddy! Descríbeme tu proceso de ventas de principio a fin, como si me lo contaras a un amigo."

Turno 4 — Usuario: [describe su proceso]

Turno 5 — Tú: "Entendido 👍 De cada 10 [primera etapa], ¿cuántas avanzan a [segunda etapa]?"

...y así sucesivamente, UNA pregunta a la vez.

---

Eres un experto en ventas consultivas B2B con profundo conocimiento en la metodología Sandler. Tu misión es construir el "Recetario Comercial" del usuario: un modelo de su embudo de ventas que responde "¿Cuántas actividades necesito hacer cada día para alcanzar mi meta?".

FLUJO (un paso a la vez, en este orden):
1. Nombre del usuario
2. Descripción de su proceso de ventas (etapas del funnel)
3. Tasa de conversión por cada transición entre etapas (una a la vez)
4. % Outbound vs Inbound (si aplica — si no distingue, asume 100% outbound)
5. Meta de ingresos mensual
6. Ticket promedio
7. Días hábiles al mes (default 20 si no sabe)
8. Nombre del escenario (sugiere uno basado en lo conversado)
9. Resumen motivador del Recetario calculado (aquí SÍ puedes usar más líneas)
10. Confirmación para guardar — cuando el usuario confirme, emite el JSON

CUANDO GENERES EL RESUMEN (paso 9): puedes usar hasta 10 líneas para presentar los resultados de forma clara y motivadora.

CUANDO EL USUARIO CONFIRME GUARDAR: incluye exactamente este JSON al final de tu respuesta (sin bloques markdown, en una sola línea):
{"action":"save_recipe","data":{"name":"<nombre>","monthly_revenue_goal":<número>,"average_ticket":<número>,"working_days":<número>,"outbound_pct":<número>,"funnel_stages":[<etapas>],"outbound_rates":[<tasas>],"inbound_rates":[<tasas>]}}

NOTAS TÉCNICAS:
- funnel_stages: array de N strings (etapas del funnel del usuario)
- outbound_rates e inbound_rates: array de N-1 números (porcentajes 1-100, una por transición)
- Si no distingue outbound/inbound: outbound_pct=100, inbound_rates igual a outbound_rates
- Responde siempre en español`

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface SaveRecipeData {
  name: string
  monthly_revenue_goal: number
  average_ticket: number
  working_days: number
  outbound_pct: number
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
}

async function saveRecipeToDb(data: SaveRecipeData): Promise<string> {
  const sb = await getSupabaseServerClient()

  const result = calcRecipe({
    monthly_revenue_goal:   data.monthly_revenue_goal,
    average_ticket:         data.average_ticket,
    outbound_pct:           data.outbound_pct,
    working_days_per_month: data.working_days,
    funnel_stages:          data.funnel_stages.length >= 2 ? data.funnel_stages : DEFAULT_FUNNEL_STAGES,
    outbound_rates:         data.outbound_rates.length > 0 ? data.outbound_rates : DEFAULT_OUTBOUND_RATES,
    inbound_rates:          data.inbound_rates.length > 0  ? data.inbound_rates  : DEFAULT_INBOUND_RATES,
  })

  const { data: scenario, error } = await sb.from('recipe_scenarios').insert({
    name:                    data.name,
    monthly_revenue_goal:    data.monthly_revenue_goal,
    average_ticket:          data.average_ticket,
    outbound_pct:            data.outbound_pct,
    working_days_per_month:  data.working_days,
    funnel_stages:           data.funnel_stages,
    outbound_rates:          data.outbound_rates,
    inbound_rates:           data.inbound_rates,
    is_active:               false,
    activities_needed_monthly: result.activities_needed_monthly,
    activities_needed_weekly:  result.activities_needed_weekly,
    activities_needed_daily:   result.activities_needed_daily,
    closes_needed_monthly:     result.closes_needed_monthly,
  }).select('id').single()

  if (error) throw new Error(error.message)
  return scenario.id
}

// Detect if the last user message is a confirmation to save or a summary request
// — those turns need more tokens for the full recipe summary + JSON payload
function needsLongResponse(messages: Message[]): boolean {
  const lastUser = [...messages].reverse().find((m) => m.role === 'user')
  if (!lastUser) return false
  const text = lastUser.content.toLowerCase()
  const confirmWords = ['sí', 'si', 'guardar', 'guarda', 'confirmo', 'confirmar', 'dale', 'ok', 'listo', 'yes', 'claro', 'adelante']
  return confirmWords.some((w) => text.includes(w)) || messages.length <= 2
}

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json()

  const encoder = new TextEncoder()
  const maxTokens = needsLongResponse(messages) ? 1024 : 200

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const claudeStream = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: maxTokens,
          system: SYSTEM_PROMPT,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
        })

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }

        // Detect save_recipe JSON action in the full response
        const jsonMatch = fullText.match(/\{"action"\s*:\s*"save_recipe"[^}]*\}(?:\s*\})?/)
        if (jsonMatch) {
          try {
            // Extract the full JSON object — it may be nested
            const jsonStart = fullText.indexOf('{"action"')
            const jsonStr = fullText.substring(jsonStart)
            // Find balanced closing brace
            let depth = 0, end = 0
            for (let i = 0; i < jsonStr.length; i++) {
              if (jsonStr[i] === '{') depth++
              else if (jsonStr[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
            }
            const parsed = JSON.parse(jsonStr.substring(0, end))
            if (parsed.action === 'save_recipe' && parsed.data) {
              const id = await saveRecipeToDb(parsed.data as SaveRecipeData)
              controller.enqueue(encoder.encode(`data: ${JSON.stringify({ action: 'saved', id })}\n\n`))
            }
          } catch {
            // JSON parse failed — ignore, don't block the stream
          }
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Error desconocido'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: msg })}\n\n`))
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  })
}
