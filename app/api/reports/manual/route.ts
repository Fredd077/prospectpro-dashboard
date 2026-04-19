import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { generateTeamReport, currentWeekStart } from '@/lib/utils/team-report'

function computePeriodEnd(pType: string, pDate: string): string {
  if (pType === 'monthly') {
    const [y, m] = pDate.split('-').map(Number)
    const lastDay = new Date(y, m, 0).getDate()
    return `${pDate.slice(0, 8)}${String(lastDay).padStart(2, '0')}`
  }
  if (pType === 'quarterly') {
    const [y, m] = pDate.split('-').map(Number)
    const endMonth = m + 2
    const endYear  = endMonth > 12 ? y + 1 : y
    const normMonth = ((endMonth - 1) % 12) + 1
    const lastDay = new Date(endYear, normMonth, 0).getDate()
    return `${endYear}-${String(normMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`
  }
  // weekly: Friday = Monday + 4 days
  const [y, mo, d] = pDate.split('-').map(Number)
  const friday = new Date(Date.UTC(y, mo - 1, d + 4))
  return `${friday.getUTCFullYear()}-${String(friday.getUTCMonth() + 1).padStart(2, '0')}-${String(friday.getUTCDate()).padStart(2, '0')}`
}

export const maxDuration = 120

export async function POST(req: Request) {
  // ── Auth: admins and org managers
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role, company, email, is_player_coach')
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
  let periodType: string | undefined
  let periodDate: string | undefined
  let memberId: string | undefined
  let memberName: string | undefined
  try {
    const body = await req.json()
    if (body?.scope === 'at_risk') scope = 'at_risk'
    if (typeof body?.company === 'string' && body.company) company = body.company
    if (Array.isArray(body?.userIds) && body.userIds.length > 0) userIds = body.userIds
    if (typeof body?.threshold === 'number') threshold = body.threshold
    if (typeof body?.period_type === 'string') periodType = body.period_type
    if (typeof body?.period_date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(body.period_date)) {
      periodDate = body.period_date
    }
    if (typeof body?.memberId === 'string' && body.memberId) memberId = body.memberId
    if (typeof body?.memberName === 'string' && body.memberName) memberName = body.memberName
  } catch {
    // defaults fine
  }

  // Managers can only report their own company — enforce server-side
  if (isManager && !isAdmin) {
    company = profile!.company ?? undefined
  }

  // Use the period_date supplied by the client (if any), otherwise default to current week
  const reportPeriodType = (periodType === 'monthly' || periodType === 'quarterly') ? periodType : 'weekly'
  const weekStart  = periodDate ?? currentWeekStart()
  const periodEnd  = computePeriodEnd(reportPeriodType, weekStart)
  const service    = getSupabaseServiceClient()

  // If player_coach and no specific member selected, ensure manager's own data is included
  let effectiveFilterUserIds = memberId ? [memberId] : userIds
  if (!memberId && isManager && !isAdmin && profile?.is_player_coach === true) {
    if (effectiveFilterUserIds !== undefined && !effectiveFilterUserIds.includes(user.id)) {
      effectiveFilterUserIds = [...effectiveFilterUserIds, user.id]
    }
  }

  try {
    const result = await generateTeamReport(
      {
        scope,
        weekStart,
        periodEnd,
        reportPeriodType,
        adminUserId:   user.id,
        adminEmail:    profile!.email,
        triggeredBy:   'manual',
        filterCompany: company,
        filterUserIds: effectiveFilterUserIds,
        threshold,
        memberName,
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
