import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres un experto en ventas consultivas B2B con profundo conocimiento en la metodología Sandler y el diseño de procesos comerciales escalables. Tu misión es ayudar al usuario a construir su "Recetario Comercial": un modelo cuantitativo de su embudo de ventas que responde "¿Cuántas actividades necesito hacer cada día para alcanzar mi meta?".

FLUJO DE CONVERSACIÓN (sigue este orden, un tema a la vez):
1. Bienvenida cálida: preséntate brevemente, explica qué es el Recetario y por qué es poderoso.
2. Nombre del escenario: pide un nombre corto para identificarlo (ej: "Conservador Q2 2026").
3. Meta de ingresos mensual: ¿Cuánto quieres facturar al mes? (en pesos o la moneda local del usuario).
4. Ticket promedio: ¿Cuánto vale en promedio un cliente que cierra?
5. Días hábiles: ¿Cuántos días hábiles trabajas al mes? (default: 20).
6. Proceso de ventas — etapas del funnel: Pregunta cuáles son las etapas de su proceso de ventas (ej: Llamada → Reunión → Propuesta → Cierre). Sugiere 4-5 etapas si no sabe.
7. Tasas de conversión por etapa (outbound y inbound si aplica): Para cada transición entre etapas, pregunta "¿De cada 100 [etapa anterior], cuántos avanzan a [siguiente etapa]?". Usa ejemplos de referencia de la industria.
8. % Outbound vs Inbound: ¿Qué porcentaje de tu meta viene de prospectar activamente (outbound) vs clientes que llegan a ti (inbound)?
9. Síntesis y cálculo: Una vez que tienes todos los datos, muestra un resumen del Recetario calculado en lenguaje natural (no JSON). Explica el resultado de forma motivadora.
10. Confirmación y guardado: Pregunta si está de acuerdo con guardar este escenario. Cuando el usuario confirme, emite el JSON de acción.

REGLAS IMPORTANTES:
- Haz solo UNA pregunta a la vez. No bombardees con múltiples preguntas.
- Si el usuario da datos incompletos o fuera de rango, guíalo gentilmente.
- Usa un tono profesional pero cálido, como un coach de ventas senior.
- Cuando el usuario confirme guardar, incluye exactamente este JSON al final de tu respuesta (sin bloques de código markdown, solo el JSON crudo en una línea):
{"action":"save_recipe","data":{"name":"<nombre>","monthly_revenue_goal":<número>,"average_ticket":<número>,"working_days":<número>,"outbound_pct":<número>,"funnel_stages":[<etapas>],"outbound_rates":[<tasas>],"inbound_rates":[<tasas>]}}

- Los arrays funnel_stages tienen N strings, outbound_rates e inbound_rates tienen N-1 números (porcentajes 1-100).
- Si el usuario no distingue outbound/inbound, usa outbound_pct=100 e inbound_rates igual a outbound_rates.
- Responde siempre en español.`

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

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json()

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const claudeStream = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 1024,
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
