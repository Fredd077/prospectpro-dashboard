import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchGerenteAnalytics, buildGerenteContext, presetRange } from '@/lib/utils/gerente-ai'
import { fetchTeamPipeline, buildPipelineContext, mergeMomentumScores } from '@/lib/utils/gerente-pipeline'
import { getAiConfig, buildSystemPrompt } from '@/lib/utils/ai-config'
import { parseISO, format, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

export const maxDuration = 60

const client = new Anthropic()
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

function periodLabel(startISO: string, endISO: string): string {
  const s = parseISO(startISO)
  const e = parseISO(endISO)
  const days = differenceInDays(e, s) + 1
  if (days <= 8) return `la semana del ${format(s, "d 'de' MMMM", { locale: es })} al ${format(e, "d 'de' MMMM 'de' yyyy", { locale: es })}`
  if (s.getMonth() === e.getMonth() && s.getFullYear() === e.getFullYear()) {
    return format(s, "MMMM 'de' yyyy", { locale: es })
  }
  if (days >= 88 && days <= 94) {
    const q = Math.floor(s.getMonth() / 3) + 1
    return `Q${q} ${s.getFullYear()} (${format(s, 'MMM', { locale: es })}–${format(e, 'MMM yyyy', { locale: es })})`
  }
  if (days >= 360) return `el año ${s.getFullYear()}`
  return `el período ${format(s, "d MMM", { locale: es })} – ${format(e, "d MMM yyyy", { locale: es })}`
}

export async function POST(req: Request) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role, company')
    .eq('id', user.id)
    .single()

  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.org_role === 'manager'
  if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let userIds: string[] = []
  let repNames: string[] = []
  let startISO = ''
  let endISO   = ''

  try {
    const body = await req.json()
    if (Array.isArray(body.userIds))   userIds  = body.userIds
    if (Array.isArray(body.repNames))  repNames = body.repNames
    if (typeof body.startISO === 'string' && ISO_RE.test(body.startISO)) startISO = body.startISO
    if (typeof body.endISO   === 'string' && ISO_RE.test(body.endISO))   endISO   = body.endISO
  } catch { /* defaults */ }

  if (!startISO || !endISO) {
    const r = presetRange('month')
    startISO = r.start
    endISO   = r.end
  }

  const service = getSupabaseServiceClient()

  if (userIds.length === 0) {
    let q = service.from('profiles').select('id,full_name').in('role', ['active', 'admin'])
    if (isManager && !isAdmin) q = q.eq('company', profile!.company as string)
    const { data: members } = await q
    userIds  = (members ?? []).map((m) => m.id)
    repNames = (members ?? []).map((m) => m.full_name ?? '').filter(Boolean)
  }

  const [analytics, pipelineRaw, config] = await Promise.all([
    fetchGerenteAnalytics(service, userIds, startISO, endISO),
    fetchTeamPipeline(service, userIds, [], startISO, endISO),
    getAiConfig('gerente_chat', service as any),
  ])
  const pipeline = mergeMomentumScores(pipelineRaw, analytics.reps)

  const actContext      = buildGerenteContext(analytics, isManager && !isAdmin ? profile!.company ?? undefined : undefined)
  const pipelineContext = buildPipelineContext(pipeline)
  const period          = periodLabel(startISO, endISO)

  const scopeDesc = repNames.length === 0
    ? 'el equipo completo'
    : repNames.length === 1
      ? repNames[0]
      : `${repNames.slice(0, -1).join(', ')} y ${repNames.at(-1)}`

  const insightPrompt = `${buildSystemPrompt(config)}

Genera un análisis ejecutivo narrativo en español sobre el desempeño comercial.

PERÍODO: ${period}
ALCANCE: ${scopeDesc}

${actContext}

${pipelineContext}

INSTRUCCIONES ESTRICTAS:
- Comienza exactamente con: "Este reporte corresponde a ${scopeDesc} durante ${period}."
- Segunda oración: el hallazgo más crítico (positivo o negativo), con número concreto
- Tercera oración: identifica el cuello de botella o fortaleza principal en pipeline
- Cuarta oración: UNA recomendación accionable específica y medible
- Máximo 4 oraciones. Sin markdown, sin bullets, solo texto corrido.
- Si el alcance es una persona, usa su nombre. Si es equipo, usa "el equipo"`

  const stream = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 300,
    system:     insightPrompt,
    messages:   [{ role: 'user', content: 'Genera el análisis ejecutivo.' }],
    stream:     true,
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of stream) {
          if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
            controller.enqueue(encoder.encode(chunk.delta.text))
          }
        }
      } finally {
        controller.close()
      }
    },
  })

  return new NextResponse(readable, {
    headers: {
      'Content-Type':      'text/plain; charset=utf-8',
      'Transfer-Encoding': 'chunked',
      'X-Accel-Buffering': 'no',
    },
  })
}
