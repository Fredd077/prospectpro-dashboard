import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { getSupabaseServiceClient } from '@/lib/supabase/server'
import { hashKey } from '@/lib/utils/crypto'
import { dispatch } from '@/lib/integrations/core/dispatcher'
import { processDealEvent } from '@/lib/integrations/core/deal-processor'
import { SkipError } from '@/lib/integrations/types'

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'ProspectPro Webhook Endpoint' })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ company: string }> }
) {
  const { company } = await params
  const companyName = decodeURIComponent(company)
  const service     = getSupabaseServiceClient()
  const receivedAt  = new Date().toISOString()

  const apiKey =
    request.headers.get('x-prospectpro-key') ??
    request.nextUrl.searchParams.get('key')

  let payload: unknown = null
  try { payload = await request.json() } catch { /* non-JSON body */ }

  // Collect headers to pass to the dispatcher and to log
  const headersToLog: Record<string, string> = {}
  const dispatchHeaders: Record<string, string> = {}
  for (const hdr of ['content-type', 'user-agent', 'x-forwarded-for', 'x-provider']) {
    const val = request.headers.get(hdr)
    if (val) { headersToLog[hdr] = val; dispatchHeaders[hdr] = val }
  }

  // Log every request — including auth failures — so users can debug from the UI
  const { data: logRow } = await service
    .from('webhook_logs')
    .insert({
      company_name: companyName,
      payload:      payload as never,
      headers:      headersToLog as never,
      status:       'received',
    })
    .select('id')
    .single()

  const logId = logRow?.id ?? ''

  if (!apiKey) {
    await service.from('webhook_logs').update({
      status: 'error', processed_at: receivedAt,
      error_message: 'Missing API key (no x-prospectpro-key header or ?key= param)',
    }).eq('id', logId)
    return NextResponse.json({ error: 'Missing API key' }, { status: 401 })
  }

  const hash = await hashKey(apiKey)

  const { data: keyRow } = await service
    .from('integration_api_keys')
    .select('id')
    .eq('key_hash', hash)
    .eq('company_name', companyName)
    .maybeSingle()

  if (!keyRow) {
    await service.from('webhook_logs').update({
      status: 'error', processed_at: receivedAt,
      error_message: 'Invalid API key — key not found for this company',
    }).eq('id', logId)
    return NextResponse.json({ error: 'Invalid API key' }, { status: 403 })
  }

  // Valid key — stamp last_used_at
  await service.from('integration_api_keys')
    .update({ last_used_at: receivedAt })
    .eq('id', keyRow.id)

  // Process asynchronously — respond 200 immediately, don't block the CRM
  void service
    .from('integrations')
    .select('admin_user_id, crm_name, config')
    .eq('company_name', companyName)
    .maybeSingle()
    .then(async ({ data: integration }) => {
      const now = new Date().toISOString()

      if (!integration) {
        return service.from('webhook_logs').update({
          status: 'skipped', processed_at: now,
          error_message: 'No integration row found for this company',
        }).eq('id', logId)
      }

      if (!integration.admin_user_id) {
        return service.from('webhook_logs').update({
          status: 'skipped', processed_at: now,
          error_message: 'Integration has no admin_user_id — regenerate your API key',
        }).eq('id', logId)
      }

      // Inject crm_name as a synthetic header so adapters can use it for unambiguous matching
      if (integration.crm_name) {
        dispatchHeaders['x-crm-name'] = integration.crm_name.toLowerCase()
      }

      try {
        const event  = dispatch(payload, dispatchHeaders, integration.config as Record<string, unknown> | null)
        const result = await processDealEvent(event, integration.admin_user_id, service)
        return service.from('webhook_logs').update({
          status:       'processed',
          processed_at: now,
          error_message: null,
        }).eq('id', logId)
          .then(() => result) // consume result to avoid unhandled promise
      } catch (err: unknown) {
        const isSkip = err instanceof SkipError
        return service.from('webhook_logs').update({
          status:        isSkip ? 'skipped' : 'error',
          processed_at:  now,
          error_message: err instanceof Error ? err.message : 'Unknown error',
        }).eq('id', logId)
      }
    })
    .catch((err: unknown) => {
      // Outer catch — prevents logs from staying as 'received' if the async chain itself throws
      void service.from('webhook_logs').update({
        status:        'error',
        processed_at:  new Date().toISOString(),
        error_message: `Async processing error: ${err instanceof Error ? err.message : String(err)}`,
      }).eq('id', logId)
    })

  return NextResponse.json({ ok: true, received_at: receivedAt })
}
