import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { generateTeamReport, currentWeekStart } from '@/lib/utils/team-report'

export const maxDuration = 120

export async function POST(req: Request) {
  // ── Auth: admins and org managers
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role, company, email')
    .eq('id', user.id)
    .single()

  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.org_role === 'manager'
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // ── Parse body
  let scope: 'team' | 'at_risk' = 'team'
  let company: string | undefined
  let userIds: string[] | undefined
  let threshold: number | undefined
  try {
    const body = await req.json()
    if (body?.scope === 'at_risk') scope = 'at_risk'
    if (typeof body?.company === 'string' && body.company) company = body.company
    if (Array.isArray(body?.userIds) && body.userIds.length > 0) userIds = body.userIds
    if (typeof body?.threshold === 'number') threshold = body.threshold
  } catch {
    // defaults fine
  }

  // Managers can only report their own company — enforce server-side
  if (isManager && !isAdmin) {
    company = profile!.company ?? undefined
  }

  const weekStart = currentWeekStart()
  const service   = getSupabaseServiceClient()

  try {
    const result = await generateTeamReport(
      {
        scope,
        weekStart,
        adminUserId:   user.id,
        adminEmail:    profile!.email,
        triggeredBy:   'manual',
        filterCompany: company,
        filterUserIds: userIds,
        threshold,
      },
      service,
    )
    return NextResponse.json(result)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[api/reports/manual] Error:', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(req: Request) {
  // ── Auth: admins and org managers — returns last 10 team reports for history panel
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role')
    .eq('id', user.id)
    .single()

  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.org_role === 'manager'
  if (!isAdmin && !isManager) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const service = getSupabaseServiceClient()
  const { data, error } = await service
    .from('coach_messages')
    .select('id, period_date, report_scope, triggered_by, sent_to_email, created_at')
    .eq('user_id', user.id)
    .eq('type', 'team_report')
    .order('created_at', { ascending: false })
    .limit(10)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reports: data ?? [] })
}
