import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { hashKey } from '@/lib/utils/crypto'
import { processPipedriveEvent } from '@/lib/integrations/pipedrive/processor'

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'ProspectPro Webhook Endpoint' })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company } = await params
  const companyName = decodeURIComponent(company)

  const apiKey =
    request.headers.get('x-prospectpro-key') ??
    request.nextUrl.searchParams.get('key')

  if (!apiKey) {
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const hash    = await hashKey(apiKey)
  const service = getSupabaseServiceClient()

  const { data: keyRow } = await service
    .from('integration_api_keys')
    .select('id')
    .eq('key_hash', hash)
    .eq('company_name', companyName)
    .maybeSingle()

  if (!keyRow) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 })
  }

  let payload: unknown = null
  try {
    payload = await request.json()
  } catch {
    // non-JSON body; store null
  }

  const headersToLog: Record<string, string> = {}
  for (const key of ['content-type', 'user-agent', 'x-forwarded-for']) {
    const val = request.headers.get(key)
    if (val) headersToLog[key] = val
  }

  const receivedAt = new Date().toISOString()

  const [{ data: logRow }] = await Promise.all([
    service
      .from('webhook_logs')
      .insert({
        company_name: companyName,
        payload:      payload as never,
        headers:      headersToLog as never,
        status:       'received',
      })
      .select('id')
      .single(),
    service
      .from('integration_api_keys')
      .update({ last_used_at: receivedAt })
      .eq('id', keyRow.id),
  ])

  // Detect CRM and process asynchronously
  if (logRow?.id) {
    const logId = logRow.id

    void service
      .from('integrations')
      .select('admin_user_id, crm_name, config')
      .eq('company_name', companyName)
      .maybeSingle()
      .then(({ data: integration }) => {
        if (integration?.crm_name?.toLowerCase() !== 'pipedrive') return

        return processPipedriveEvent(payload, integration as { admin_user_id: string | null; config: Record<string, unknown> | null }, service)
          .then((result) =>
            service
              .from('webhook_logs')
              .update({
                status:       result.action === 'skipped' ? 'skipped' : 'processed',
                processed_at: new Date().toISOString(),
              })
              .eq('id', logId)
          )
          .catch((err: unknown) =>
            service
              .from('webhook_logs')
              .update({
                status:        'error',
                processed_at:  new Date().toISOString(),
                error_message: err instanceof Error ? err.message : 'Unknown error',
              })
              .eq('id', logId)
          )
      })
  }

  return NextResponse.json({ ok: true, received_at: receivedAt })
}
