import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

// Allow up to 60 seconds — Vercel default (10-15s) is too short for streaming LLM responses
export const maxDuration = 60

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
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

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
    user_id:                 user.id,
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
    // closes_needed_monthly NO va acá: la migración 006_funnel_stages.sql
    // eliminó esa columna de recipe_scenarios hace tiempo (DROP COLUMN IF
    // EXISTS), pero este insert nunca se actualizó. Resultado: TODO guardado
    // de Recetario vía IA fallaba siempre con "Could not find the
    // 'closes_needed_monthly' column ... in the schema cache" — sin importar
    // tokens ni redacción de la confirmación. Lo encontré recién, probando
    // el onboarding de punta a punta con un usuario real.
  }).select('id').single()

  if (error) throw new Error(error.message)
  return scenario.id
}

// Presupuesto de tokens FIJO para todos los turnos. Antes se decidía con una lista
// cerrada de "palabras de confirmación" (sí/dale/ok/...) — comprobado en producción
// que es frágil: cualquier confirmación natural que no esté en la lista ("correcto",
// "procede", "me parece bien") deja el turno con solo 200 tokens, que no alcanzan ni
// para el resumen del paso 9 ni para el JSON del paso 10. Peor: una vez que el resumen
// se corta, el modelo intenta "recalcular antes de mostrar el resumen final" en cada
// turno siguiente, y ese intento TAMBIÉN se corta — la conversación queda atascada sin
// ninguna señal de error. max_tokens es solo un techo, no se cobra por lo que no se usa
// (los turnos normales de una pregunta usan 20-50 tokens con este mismo techo), así que
// no hay costo por subirlo — solo evita el corte.
const MAX_TOKENS = 2048

export async function POST(req: Request) {
  const { messages }: { messages: Message[] } = await req.json()

  const encoder = new TextEncoder()
  const maxTokens = MAX_TOKENS

  const stream = new ReadableStream({
    async start(controller) {
      let fullText = ''

      try {
        const claudeStream = client.messages.stream(
          {
            model: 'claude-sonnet-4-6',
            max_tokens: maxTokens,
            system: SYSTEM_PROMPT,
            messages: messages.map((m) => ({ role: m.role, content: m.content })),
          },
          { signal: AbortSignal.timeout(55_000) },
        )

        // Send SSE keepalive pings every 3s until first token arrives.
        // This prevents Vercel / proxies from closing an idle connection
        // while Claude is still thinking before the first word.
        let firstToken = false
        const ping = setInterval(() => {
          if (!firstToken) controller.enqueue(encoder.encode(': ping\n\n'))
        }, 3000)

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            if (!firstToken) { firstToken = true; clearInterval(ping) }
            fullText += event.delta.text
            controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`))
          }
        }
        clearInterval(ping)

        // stop_reason del mensaje completo. Con MAX_TOKENS=2048 esto NUNCA debería
        // salir 'max_tokens' — si sale, el modelo se extendió de forma anómala
        // (el system prompt limita a 3 líneas por turno, 10 en el resumen) y lo que
        // se envió al cliente está incompleto a mitad de frase o de JSON.
        const finalMessage = await claudeStream.finalMessage()
        const wasTruncated = finalMessage.stop_reason === 'max_tokens'

        // Detect save_recipe JSON action in the full response — el chequeo previo
        // era una regex frágil (`[^}]*\}` no cruza el objeto anidado "data"); alcanza
        // con confirmar que el marcador está presente, el parseo real usa el escaneo
        // de llaves balanceadas de abajo.
        //
        // Tres desenlaces posibles, y hay que distinguirlos porque cada uno necesita
        // un mensaje distinto: (1) el JSON nunca cerró → cortado por tokens, un
        // reintento con una generación nueva puede salir bien; (2) el JSON cerró pero
        // guardar en la base falló (auth, DB) → reintentar la MISMA respuesta no
        // arregla eso, hay que decirlo distinto; (3) todo salió bien.
        let jsonIncomplete = false
        let saveFailed = false
        if (fullText.includes('{"action"')) {
          const jsonStart = fullText.indexOf('{"action"')
          const jsonStr = fullText.substring(jsonStart)
          // Find balanced closing brace
          let depth = 0, end = 0
          for (let i = 0; i < jsonStr.length; i++) {
            if (jsonStr[i] === '{') depth++
            else if (jsonStr[i] === '}') { depth--; if (depth === 0) { end = i + 1; break } }
          }
          if (end === 0) {
            // El objeto se abrió pero nunca cerró — cortado a mitad de JSON.
            jsonIncomplete = true
          } else {
            try {
              const parsed = JSON.parse(jsonStr.substring(0, end))
              if (parsed.action === 'save_recipe' && parsed.data) {
                try {
                  const id = await saveRecipeToDb(parsed.data as SaveRecipeData)
                  // Se devuelve también `data` (no solo el id): el onboarding la
                  // necesita para armar el paso de Actividades sin tener que releer
                  // el escenario recién creado.
                  controller.enqueue(encoder.encode(`data: ${JSON.stringify({ action: 'saved', id, data: parsed.data })}\n\n`))
                } catch (saveErr) {
                  console.error('[ai-recipe] JSON válido pero saveRecipeToDb falló:', saveErr)
                  saveFailed = true
                }
              }
            } catch (parseErr) {
              // El JSON parece completo (llaves balanceadas) pero no es válido —
              // no debería pasar con el modelo, pero lo dejamos visible en logs
              // para poder diagnosticarlo si vuelve a ocurrir.
              console.error('[ai-recipe] JSON balanceado pero JSON.parse falló:', parseErr, jsonStr.substring(0, end))
              jsonIncomplete = true
            }
          }
        }

        // Señal de fallo visible. Antes esto se tragaba en silencio — el usuario se
        // quedaba con un mensaje a medias sin ningún error ni reintento. Ahora se
        // trata igual que un error de red: el frontend ya sabe reintentar
        // automáticamente (hasta 3 veces) cuando recibe `error`.
        if (saveFailed) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Tu recetario se calculó bien pero no lo pude guardar. Reintentando...' })}\n\n`))
        } else if (wasTruncated || jsonIncomplete) {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: 'Se me cortó la respuesta, dame un segundo para reintentar...' })}\n\n`))
        }

        controller.enqueue(encoder.encode('data: [DONE]\n\n'))
      } catch (err) {
        const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError')
        const userMsg = isTimeout
          ? 'Ups, tardé demasiado en responder. ¿Intentamos de nuevo?'
          : 'Ups, tuve un problema conectando con el coach. ¿Intentamos de nuevo?'
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ error: userMsg })}\n\n`))
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
