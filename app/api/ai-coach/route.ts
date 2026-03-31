import Anthropic from '@anthropic-ai/sdk'
import { startOfWeek, startOfMonth, subWeeks, parseISO } from 'date-fns'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import {
  buildDailyContext,
  buildWeeklyContext,
  buildMonthlyContext,
  formatContextForPrompt,
} from '@/lib/utils/coach-context'
import { COACH_SYSTEM_PROMPT } from '@/lib/utils/coach-generator'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

// Detect if the response needs extended tokens (summary/confirmation/monthly)
function maxTokensForType(type: string, messages?: { role: string; content: string }[]): number {
  if (type === 'monthly') return 500
  if (type === 'weekly')  return 300
  // For daily: check if last user message is a confirmation to save
  const lastUser = messages && [...messages].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    const confirmWords = ['sí', 'si', 'guardar', 'guarda', 'confirmo', 'dale', 'ok', 'listo', 'yes', 'claro', 'adelante']
    if (confirmWords.some((w) => lastUser.content.toLowerCase().includes(w))) return 1024
  }
  return 300
}

export async function POST(req: Request) {
  const { type } = await req.json() as { type: 'daily' | 'weekly' | 'monthly' }

  const sb    = await getSupabaseServerClient()
  const today = todayISO()

  // Cache key: always the "generation Monday" for weekly, first of month for monthly, today for daily
  const todayDate  = parseISO(today)
  const isMonday   = todayDate.getDay() === 1
  const thisMonday = toISODate(startOfWeek(todayDate, { weekStartsOn: 1 }))
  const monthStart = toISODate(startOfMonth(todayDate))

  // For weekly on Monday: analyse the previous week (it just ended)
  const weekToAnalyze = type === 'weekly' && isMonday
    ? toISODate(subWeeks(parseISO(thisMonday), 1))
    : thisMonday

  // For weekly: period_date = the analyzed week's Monday (not the generation Monday).
  // This makes CoachHistoryClient's "+6 days" label always show the correct Mon-Sun range.
  const periodDate =
    type === 'daily'   ? today :
    type === 'weekly'  ? weekToAnalyze :
    monthStart

  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      function send(payload: object) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`))
      }

      try {
        // ── Check DB cache ──────────────────────────────────────────────────
        const { data: cached } = await sb
          .from('coach_messages')
          .select('id,message')
          .eq('type', type)
          .eq('period_date', periodDate)
          .maybeSingle()

        if (cached) {
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
        const ctx =
          type === 'daily'   ? await buildDailyContext(today) :
          type === 'weekly'  ? { ...await buildWeeklyContext(weekToAnalyze), isMondayAnalysis: isMonday } :
          await buildMonthlyContext(monthStart)

        const userContent = formatContextForPrompt(ctx)

        // ── Call Claude ─────────────────────────────────────────────────────
        let fullText = ''
        const claudeStream = client.messages.stream({
          model: 'claude-sonnet-4-6',
          max_tokens: maxTokensForType(type),
          system: COACH_SYSTEM_PROMPT,
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
              is_read:     false,
            })
            .select('id')
            .single()
          savedId = saved?.id ?? null
        } catch {
          console.error('[ai-coach] Failed to save coach message to DB')
        }

        send({ done: true, id: savedId })
      } catch (err) {
        console.error('[ai-coach] Error:', err)
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

// ── Save user comment / mark read ─────────────────────────────────────────────

export async function PATCH(req: Request) {
  const body = await req.json() as { id?: string; comment?: string; markAllRead?: boolean }
  const sb   = await getSupabaseServerClient()

  if (body.markAllRead) {
    await sb.from('coach_messages').update({ is_read: true }).eq('is_read', false)
    return new Response(null, { status: 204 })
  }

  if (body.id && body.comment !== undefined) {
    await sb.from('coach_messages').update({ user_comment: body.comment }).eq('id', body.id)
    return new Response(null, { status: 204 })
  }

  return new Response(null, { status: 400 })
}
