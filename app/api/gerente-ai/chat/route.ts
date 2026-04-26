import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchGerenteAnalytics, buildGerenteContext, presetRange } from '@/lib/utils/gerente-ai'
import { fetchTeamPipeline, buildPipelineContext } from '@/lib/utils/gerente-pipeline'

export const maxDuration = 60

const client = new Anthropic()

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export async function POST(req: Request) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role, company, full_name')
    .eq('id', user.id)
    .single()

  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.org_role === 'manager'
  if (!isAdmin && !isManager) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let messages: { role: 'user' | 'assistant'; content: string }[] = []
  let userIds: string[] = []
  let startISO = ''
  let endISO   = ''

  try {
    const body = await req.json()
    if (Array.isArray(body.messages)) messages = body.messages
    if (Array.isArray(body.userIds) && body.userIds.length > 0) userIds = body.userIds
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
    let q = service.from('profiles').select('id').in('role', ['active', 'admin'])
    if (isManager && !isAdmin) q = q.eq('company', profile!.company as string)
    const { data: members } = await q
    userIds = (members ?? []).map((m) => m.id)
  }

  // Fetch activity + pipeline in parallel for richer AI context
  const [analytics, pipeline] = await Promise.all([
    fetchGerenteAnalytics(service, userIds, startISO, endISO),
    fetchTeamPipeline(service, userIds, [], startISO, endISO),
  ])

  const actContext      = buildGerenteContext(analytics, isManager ? profile!.company ?? undefined : undefined)
  const pipelineContext = buildPipelineContext(pipeline)

  const systemPrompt = `Eres el Gerente Virtual AI de ProspectPro — el asistente de inteligencia comercial más avanzado para equipos de ventas. Tu misión es ayudar a los managers a tomar decisiones basadas en datos, identificar patrones ocultos, predecir resultados y dar recomendaciones accionables.

Responde siempre en español. Sé conciso, directo y usa datos reales. Cuando identifiques problemas, da recomendaciones específicas. Usa emojis con moderación para puntos clave.

${actContext}

${pipelineContext}

INSTRUCCIONES DE ANÁLISIS:
- Combina datos de actividad Y pipeline para dar una visión completa
- Identifica correlaciones: ¿Los reps con mayor actividad tienen mejor win rate?
- Si un rep tiene buen momentum de actividad pero mal pipeline, investiga qué está pasando
- Si la proyección de ingresos está por debajo de la meta, sugiere acciones concretas
- Identifica patrones temporales: ¿Hay semanas con caída sistemática?
- Cuando un rep esté "en riesgo", da un plan de coaching específico
- Basa todas las respuestas en los datos reales mostrados arriba`

  const stream = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: 1500,
    system:     systemPrompt,
    messages,
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
