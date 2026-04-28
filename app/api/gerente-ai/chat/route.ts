import { NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchGerenteAnalytics, buildGerenteContext, presetRange } from '@/lib/utils/gerente-ai'
import { fetchTeamPipeline, buildPipelineContext } from '@/lib/utils/gerente-pipeline'
import { getAiConfig, buildSystemPrompt } from '@/lib/utils/ai-config'

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

  const config = await getAiConfig('gerente_chat', service)
  const dataContext = `${actContext}\n\n${pipelineContext}`
  const systemPrompt = buildSystemPrompt(config, dataContext)

  const stream = await client.messages.create({
    model:      'claude-sonnet-4-6',
    max_tokens: config.maxTokens,
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
