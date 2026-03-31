import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { buildDailyContext, buildWeeklyContext, formatContextForPrompt } from '@/lib/utils/coach-context'
import { startOfWeek, parseISO } from 'date-fns'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const SYSTEM_PROMPT = `Eres el Coach Comercial de ProspectPro. Tu nombre es "Coach Pro".
Conoces profundamente la metodología Sandler y el proceso comercial del usuario.

PERSONALIDAD:
- Directo y honesto — nunca suavizas la verdad
- Motivador pero realista — celebras logros, señalas brechas
- Hablas como un coach experimentado, no como un robot
- Usas el nombre del usuario siempre
- Máximo 4-5 oraciones — ve al grano
- Terminas siempre con UNA acción concreta y específica

PARA ANÁLISIS DIARIO, sigue esta estructura:
1. Una línea reconociendo el día (positivo o constructivo)
2. Señala el canal más preocupante si hay uno por debajo del 50%
3. Da UNA acción específica y medible para mañana
4. Frase motivadora corta al final (opcional, solo si aplica)

PARA ANÁLISIS SEMANAL, sigue esta estructura:
1. Balance general de la semana en una línea
2. Tu canal más fuerte esta semana fue: [canal] ([%])
3. Tu canal más débil esta semana fue: [canal] ([%])
4. Impacto en tu meta mensual: vas al [X]% del mes
5. UNA recomendación prioritaria para la próxima semana
6. Si la tendencia es negativa 2+ semanas seguidas, menciona que hay que revisar el recetario

REGLAS:
- NUNCA hagas más de una pregunta
- NUNCA uses markdown con ** o ## en el texto
- Usa emojis con moderación (máximo 2 por mensaje)
- Sé específico con números: "5 llamadas" no "más llamadas"
- Siempre referencia su recetario: "según tu recetario necesitas X por semana"
- Responde siempre en español`

export async function POST(req: Request) {
  const { type } = await req.json() as { type: 'daily' | 'weekly' }

  const sb    = await getSupabaseServerClient()
  const today = todayISO()

  // Determine the period_date key
  const periodDate = type === 'daily'
    ? today
    : toISODate(startOfWeek(parseISO(today), { weekStartsOn: 1 }))

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      try {
        // ── Check DB cache first ────────────────────────────────────────────
        const { data: cached } = await sb
          .from('coach_messages')
          .select('id,message')
          .eq('type', type)
          .eq('period_date', periodDate)
          .maybeSingle()

        if (cached) {
          // Stream cached message chunk by chunk for the same feel
          const words = cached.message.split(' ')
          for (const word of words) {
            send({ text: word + ' ' })
            await new Promise((r) => setTimeout(r, 18))
          }
          send({ cached: true, id: cached.id })
          send({ done: true })
          controller.close()
          return
        }

        // ── Build context ───────────────────────────────────────────────────
        const ctx = type === 'daily'
          ? await buildDailyContext(today)
          : await buildWeeklyContext(periodDate)

        const userContent = formatContextForPrompt(ctx)

        // ── Call Claude ─────────────────────────────────────────────────────
        let fullText = ''
        const claudeStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: 300,
          system: SYSTEM_PROMPT,
          messages: [{ role: 'user', content: userContent }],
        })

        for await (const event of claudeStream) {
          if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
            fullText += event.delta.text
            send({ text: event.delta.text })
          }
        }

        // ── Save to DB ──────────────────────────────────────────────────────
        let savedId: string | null = null
        try {
          const { data: saved } = await sb
            .from('coach_messages')
            .insert({
              type,
              message:     fullText,
              context:     JSON.parse(JSON.stringify(ctx)),
              period_date: periodDate,
            })
            .select('id')
            .single()
          savedId = saved?.id ?? null
        } catch {
          // Non-fatal — message was shown, just not persisted
          console.error('[ai-coach] Failed to save coach message to DB')
        }

        send({ done: true, id: savedId })
      } catch (err) {
        console.error('[ai-coach] Error:', err)
        // Silent failure — don't expose error to client
        send({ done: true, silent_error: true })
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

// ── Save user comment ──────────────────────────────────────────────────────

export async function PATCH(req: Request) {
  const { id, comment } = await req.json() as { id: string; comment: string }
  const sb = await getSupabaseServerClient()
  await sb.from('coach_messages').update({ user_comment: comment }).eq('id', id)
  return new Response(null, { status: 204 })
}
