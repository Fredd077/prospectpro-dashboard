import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { hashKey } from '@/lib/utils/crypto'

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'ProspectPro Webhook Endpoint' })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company } = await params

  // Read API key from header or query param
  const apiKey =
    request.headers.get('x-prospectpro-key') ??
    request.nextUrl.searchParams.get('key')

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const hash = await hashKey(apiKey)
  const service = getSupabaseServiceClient()

  // Verify key belongs to this company
  const { data: keyRow } = await service
    .from('integration_api_keys')
    .select('id')
    .eq('key_hash', hash)
    .eq('company_name', company)
    .maybeSingle()

  if (!keyRow) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 })
  }

  // Parse body
  let payload: unknown = null
  try {
    payload = await request.json()
  } catch {
    // non-JSON body is allowed; just store null
  }

  // Capture a small set of headers (avoid storing sensitive/large headers)
  const headersToLog: Record<string, string> = {}
  for (const key of ['content-type', 'user-agent', 'x-forwarded-for']) {
    const val = request.headers.get(key)
    if (val) headersToLog[key] = val
  }

  const receivedAt = new Date().toISOString()

  // Log and update in parallel (fire and don't fail on log errors)
  await Promise.all([
    service.from('webhook_logs').insert({
      company_name: company,
      payload: payload as never,
      headers: headersToLog as never,
      status: 'received',
    }),
    service
      .from('integration_api_keys')
      .update({ last_used_at: receivedAt })
      .eq('id', keyRow.id),
  ])

  return NextResponse.json({ ok: true, received_at: receivedAt })
}
