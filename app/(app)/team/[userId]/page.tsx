import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { Suspense } from 'react'
import { ArrowLeft, Building2, Mail, Clock, Sparkles } from 'lucide-react'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { TeamUserGoalEditor } from '@/components/team/TeamUserGoalEditor'
import { ActivityBreakdownTable } from '@/components/dashboard/ActivityBreakdownTable'
import type { ActivityBreakdownRow } from '@/components/dashboard/ActivityBreakdownTable'
import { PeriodSelector } from '@/components/team/PeriodSelector'
import { todayISO, toISODate, getPeriodRange, addDaysToISO } from '@/lib/utils/dates'
import { fmtUSD } from '@/lib/calculations/pipeline'
import { getActivityGoal } from '@/lib/utils/goals'
import type { PeriodType } from '@/lib/types/common'
import { parseISO, format, formatDistanceToNow, addDays, getISOWeek, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'

export const revalidate = 0

export const metadata: Metadata = { title: 'Perfil de usuario — ProspectPro' }

type PeriodOption = 'week' | 'last_week' | 'month' | 'last_month' | 'quarter' | 'year' | 'custom'

interface Props {
  params:       Promise<{ userId: string }>
  searchParams: Promise<{ period?: string; tab?: string; from?: string; to?: string }>
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Avatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl: string | null }) {
  const str    = name ?? email
  const parts  = str.split(/[\s@]/).filter(Boolean)
  const initials = parts.length >= 2 ? `${parts[0][0]}${parts[1][0]}`.toUpperCase() : str.slice(0, 2).toUpperCase()
  return avatarUrl ? (
    <img src={avatarUrl} alt={name ?? email} style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', border: '2px solid rgba(255,255,255,0.12)', flexShrink: 0 }} />
  ) : (
    <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(0,217,255,0.1)', color: '#00D9FF', fontSize: 18, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '2px solid rgba(0,217,255,0.2)', flexShrink: 0 }}>
      {initials}
    </div>
  )
}

function statusBadge(pct: number) {
  if (pct >= 70) return { label: 'En racha',          color: '#1D9E75', bg: 'rgba(29,158,117,0.1)',  border: 'rgba(29,158,117,0.3)' }
  if (pct >= 40) return { label: 'Necesita atención', color: '#BA7517', bg: 'rgba(186,117,23,0.1)',  border: 'rgba(186,117,23,0.3)' }
  return               { label: 'En riesgo',          color: '#E24B4A', bg: 'rgba(226,75,74,0.1)',   border: 'rgba(226,75,74,0.3)' }
}

function semColor(pct: number) {
  if (pct >= 100) return '#1D9E75'
  if (pct >= 70)  return '#BA7517'
  return '#E24B4A'
}

// ── Inline SVG trend chart ────────────────────────────────────────────────────

function TrendChart({ weeks }: { weeks: { label: string; pct: number }[] }) {
  if (weeks.length < 2) return null
  const W = 560, H = 90
  const pad = { top: 24, bottom: 20, left: 6, right: 6 }
  const iW  = W - pad.left - pad.right
  const iH  = H - pad.top - pad.bottom
  const n   = weeks.length

  const pts = weeks.map((w, i) => ({
    x: pad.left + (i / (n - 1)) * iW,
    y: pad.top  + (1 - Math.min(w.pct, 120) / 120) * iH,
    ...w,
  }))

  const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ')
  const area = `${line} L${pts[n - 1].x},${pad.top + iH} L${pts[0].x},${pad.top + iH} Z`

  return (
    <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible', display: 'block' }}>
      <defs>
        <linearGradient id="tg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#00D9FF" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#00D9FF" stopOpacity="0"    />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#tg)" />
      <path d={line} fill="none" stroke="#00D9FF" strokeWidth="1.5" strokeLinejoin="round" />
      {pts.map((p, i) => (
        <g key={i}>
          <circle cx={p.x} cy={p.y} r={3} fill="#00D9FF" />
          <text x={p.x} y={p.y - 7} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.5)">
            {p.pct}%
          </text>
          <text x={p.x} y={H - 2} textAnchor="middle" fontSize={9} fill="rgba(255,255,255,0.28)">
            {p.label}
          </text>
        </g>
      ))}
    </svg>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default async function TeamUserPage({ params, searchParams }: Props) {
  const { userId }                              = await params
  const { period: periodParam, tab, from: fromParam = '', to: toParam = '' } = await searchParams

  const VALID_PERIODS: PeriodOption[] = ['week', 'last_week', 'month', 'last_month', 'quarter', 'year', 'custom']
  const period: PeriodOption = VALID_PERIODS.includes(periodParam as PeriodOption)
    ? (periodParam as PeriodOption)
    : 'week'

  // ── Auth + role check ────────────────────────────────────────────────────
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const service = getSupabaseServiceClient()
  const { data: myProfile } = await service.from('profiles').select('role,org_role,company').eq('id', user.id).single()
  const isAdmin   = myProfile?.role === 'admin'
  const isManager = myProfile?.org_role === 'manager'
  if (!isAdmin && !isManager) redirect('/dashboard')

  const { data: profile } = await service.from('profiles').select('*').eq('id', userId).single()
  if (!profile) notFound()
  if (isManager && !isAdmin && (!profile.company || profile.company !== myProfile?.company)) redirect('/team')

  // ── Period bounds ────────────────────────────────────────────────────────
  const today = todayISO()

  let periodStart: string, periodEnd: string
  switch (period) {
    case 'last_week':
      ({ start: periodStart, end: periodEnd } = getPeriodRange('weekly',    addDays(parseISO(today), -7)))
      break
    case 'month':
      ({ start: periodStart, end: periodEnd } = getPeriodRange('monthly',   parseISO(today)))
      break
    case 'last_month':
      ({ start: periodStart, end: periodEnd } = getPeriodRange('monthly',   addDays(parseISO(today), -32)))
      break
    case 'quarter':
      ({ start: periodStart, end: periodEnd } = getPeriodRange('quarterly', parseISO(today)))
      break
    case 'year':
      ({ start: periodStart, end: periodEnd } = getPeriodRange('yearly',    parseISO(today)))
      break
    case 'custom':
      periodStart = /^\d{4}-\d{2}-\d{2}$/.test(fromParam) ? fromParam : today
      periodEnd   = /^\d{4}-\d{2}-\d{2}$/.test(toParam)   ? toParam   : today
      break
    default: // week
      ({ start: periodStart, end: periodEnd } = getPeriodRange('weekly',    parseISO(today)))
  }

  // Prev period for compliance delta
  let prevStart: string, prevEnd: string
  if (period === 'custom') {
    const days = differenceInDays(parseISO(periodEnd), parseISO(periodStart)) + 1
    const pEnd = addDaysToISO(periodStart, -1)
    prevStart  = addDaysToISO(pEnd, -(days - 1))
    prevEnd    = pEnd
  } else {
    const prevPType: PeriodType =
      period === 'month' || period === 'last_month' ? 'monthly'
      : period === 'quarter' ? 'quarterly'
      : period === 'year'    ? 'yearly'
      : 'weekly'
    ;({ start: prevStart, end: prevEnd } = getPeriodRange(prevPType, addDays(parseISO(periodStart), -1)))
  }

  // Trend: last 6 calendar weeks ending today
  const trendWeeks: { start: string; end: string; label: string }[] = []
  for (let i = 5; i >= 0; i--) {
    const a         = addDays(parseISO(today), -i * 7)
    const { start, end } = getPeriodRange('weekly', a)
    trendWeeks.push({ start, end, label: `S${getISOWeek(parseISO(start))}` })
  }
  const trendRangeStart = trendWeeks[0].start
  const past30Start     = addDaysToISO(today, -29)

  // ── Fetch all data ───────────────────────────────────────────────────────
  const [
    activitiesRes,
    periodLogsRes,
    prevLogsRes,
    trendLogsRes,
    streakLogsRes,
    scenarioRes,
    pipelineRes,
    coachRes,
    activitiesForEditRes,
  ] = await Promise.all([
    service.from('activities')
      .select('id,name,type,channel,daily_goal,weekly_goal,monthly_goal')
      .eq('user_id', userId).eq('status', 'active')
      .order('sort_order').order('name'),

    service.from('activity_logs')
      .select('activity_id,real_executed,day_goal')
      .eq('user_id', userId).gte('log_date', periodStart).lte('log_date', periodEnd),

    service.from('activity_logs')
      .select('activity_id,real_executed,day_goal')
      .eq('user_id', userId).gte('log_date', prevStart).lte('log_date', prevEnd),

    service.from('activity_logs')
      .select('log_date,real_executed,day_goal')
      .eq('user_id', userId).gte('log_date', trendRangeStart).lte('log_date', today),

    service.from('activity_logs')
      .select('log_date')
      .eq('user_id', userId).gte('log_date', past30Start).lte('log_date', today),

    service.from('recipe_scenarios')
      .select('monthly_revenue_goal')
      .eq('user_id', userId).eq('is_active', true)
      .order('created_at', { ascending: false }).limit(1).maybeSingle(),

    service.from('pipeline_simple')
      .select('stage, status, amount_usd')
      .eq('user_id', userId)
      .gte('entry_date', periodStart).lte('entry_date', periodEnd),

    service.from('coach_messages')
      .select('id,type,message,period_date,created_at')
      .eq('user_id', userId).eq('type', 'weekly')
      .order('period_date', { ascending: false }).limit(1).maybeSingle(),

    tab === 'activities'
      ? service.from('activities')
          .select('id,name,channel,type,monthly_goal,weekly_goal,daily_goal,status')
          .eq('user_id', userId).order('status').order('sort_order').order('name')
      : Promise.resolve({ data: null }),
  ])

  const activities        = activitiesRes.data ?? []
  const activeActivityIds = new Set(activities.map(a => a.id))
  const periodLogs = (periodLogsRes.data ?? []).filter(l => activeActivityIds.has(l.activity_id))
  const prevLogs   = (prevLogsRes.data   ?? []).filter(l => activeActivityIds.has(l.activity_id))
  const trendLogs  = trendLogsRes.data ?? []
  const lastCoach  = coachRes.data

  // ── Period type mapping (mirrors dashboard logic) ───────────────────────
  const periodType: PeriodType =
    period === 'month' || period === 'last_month' ? 'monthly'
    : period === 'quarter' ? 'quarterly'
    : period === 'year'    ? 'yearly'
    : 'weekly'

  // ── Compliance — use activity configured goals, same as dashboard ────────
  const periodReal = periodLogs.reduce((s, l) => s + l.real_executed, 0)
  const periodGoal = activities.reduce((s, a) => s + getActivityGoal(a, periodType), 0)
  const periodPct  = periodGoal > 0 ? Math.round((periodReal / periodGoal) * 100) : 0

  const prevReal   = prevLogs.reduce((s, l) => s + l.real_executed, 0)
  const prevGoal   = activities.reduce((s, a) => s + getActivityGoal(a, periodType), 0)
  const prevPct    = prevGoal > 0 ? Math.round((prevReal / prevGoal) * 100) : 0
  const delta      = periodPct - prevPct

  // ── Activity breakdown rows ──────────────────────────────────────────────
  const realByAct: Record<string, number> = {}
  for (const l of periodLogs) {
    realByAct[l.activity_id] = (realByAct[l.activity_id] ?? 0) + l.real_executed
  }
  const breakdownRows: ActivityBreakdownRow[] = activities.map((a) => ({
    id:      a.id,
    name:    a.name,
    type:    a.type as 'OUTBOUND' | 'INBOUND',
    channel: a.channel,
    goal:    getActivityGoal(a, periodType),
    real:    realByAct[a.id] ?? 0,
  }))

  // ── Streak ───────────────────────────────────────────────────────────────
  const streakDays = new Set((streakLogsRes.data ?? []).map((l) => l.log_date)).size

  // ── Trend data ───────────────────────────────────────────────────────────
  const trendData = trendWeeks.map(({ start, end, label }) => {
    const wLogs = trendLogs.filter((l) => l.log_date >= start && l.log_date <= end)
    const r     = wLogs.reduce((s, l) => s + l.real_executed, 0)
    const g     = wLogs.reduce((s, l) => s + l.day_goal, 0)
    return { label, pct: g > 0 ? Math.round((r / g) * 100) : 0 }
  })

  // ── Pipeline ─────────────────────────────────────────────────────────────
  const pipeRows   = pipelineRes.data ?? []
  const wonAmount  = pipeRows.filter(r => r.stage === 'Por facturar/cobrar' && r.amount_usd != null).reduce((s, r) => s + r.amount_usd!, 0)
  const openAmount = pipeRows.filter(r => r.status === 'abierto' && r.stage !== 'Primera reu ejecutada/Propuesta en preparación' && r.amount_usd != null).reduce((s, r) => s + r.amount_usd!, 0)
  const lostAmount = pipeRows.filter(r => r.status === 'perdido' && r.amount_usd != null).reduce((s, r) => s + r.amount_usd!, 0)
  const wonCount   = pipeRows.filter(r => r.stage === 'Por facturar/cobrar' && r.status === 'ganado').length
  const lostCount  = pipeRows.filter(r => r.status === 'perdido').length
  const openCount  = pipeRows.filter(r => r.status === 'abierto' && r.stage !== 'Primera reu ejecutada/Propuesta en preparación').length
  const stageCounts: Record<string, number> = {}
  for (const r of pipeRows) { stageCounts[r.stage] = (stageCounts[r.stage] ?? 0) + 1 }
  const dashPipeline = {
    stageCounts,
    wonAmount,
    openAmount,
    lostAmount,
    wonCount,
    lostCount,
    openCount,
    monthlyGoal: Number(scenarioRes.data?.monthly_revenue_goal ?? 0),
  }

  // ── Labels ───────────────────────────────────────────────────────────────
  let periodDisplayLabel: string
  if (period === 'month' || period === 'last_month') {
    periodDisplayLabel = format(parseISO(periodStart), 'MMMM yyyy', { locale: es })
  } else if (period === 'quarter') {
    periodDisplayLabel = `Q${Math.ceil((parseISO(periodStart).getMonth() + 1) / 3)} ${parseISO(periodStart).getFullYear()}`
  } else if (period === 'year') {
    periodDisplayLabel = String(parseISO(periodStart).getFullYear())
  } else if (period === 'custom' && fromParam && toParam) {
    periodDisplayLabel = `${format(parseISO(fromParam), 'd MMM', { locale: es })} – ${format(parseISO(toParam), 'd MMM yyyy', { locale: es })}`
  } else {
    periodDisplayLabel = `${format(parseISO(periodStart), 'd MMM', { locale: es })} – ${format(parseISO(periodEnd), 'd MMM yyyy', { locale: es })}`
  }

  const status = statusBadge(periodPct)

  // ── Coach week label ─────────────────────────────────────────────────────
  let coachWeekLabel = ''
  if (lastCoach) {
    try {
      const d = parseISO(lastCoach.period_date)
      coachWeekLabel = `${format(d, 'd MMM', { locale: es })} – ${format(addDays(d, 6), 'd MMM yyyy', { locale: es })}`
    } catch { coachWeekLabel = lastCoach.period_date }
  }

  // ── Activities tab — admin escape hatch ──────────────────────────────────
  if (tab === 'activities') {
    const activitiesForEdit = ((activitiesForEditRes?.data ?? []) as {
      id: string; name: string; channel: string; type: 'OUTBOUND' | 'INBOUND'
      monthly_goal: number; weekly_goal: number; daily_goal: number; status: 'active' | 'inactive'
    }[])
    return (
      <div className="flex flex-col h-full">
        <div style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', background: '#0d0d0d', padding: '20px 32px 16px', flexShrink: 0 }}>
          <div style={{ marginBottom: 12 }}>
            <Link href={`/team/${userId}`} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'rgba(255,255,255,0.4)', textDecoration: 'none' }}
              className="hover:text-white transition-colors">
              <ArrowLeft style={{ width: 14, height: 14 }} /> Volver al perfil
            </Link>
          </div>
          <h1 style={{ fontSize: 16, fontWeight: 600, color: '#ffffff', marginBottom: 4 }}>
            Editar actividades — {profile.full_name ?? profile.email}
          </h1>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)' }}>
            Edita metas mensuales. Los valores semanales y diarios se recalculan automáticamente.
          </p>
        </div>
        <div style={{ flex: 1, overflowY: 'auto', padding: '32px' }}>
          <div style={{ maxWidth: 720 }}>
            {activitiesForEdit.length === 0
              ? <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}>Sin actividades configuradas.</p>
              : <TeamUserGoalEditor activities={activitiesForEdit} userId={userId} />
            }
          </div>
        </div>
      </div>
    )
  }

  // ── Main profile view ────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full">

      {/* ── Sticky header ──────────────────────────────────────────────────── */}
      <div style={{
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        background: 'rgba(10,10,10,0.96)',
        backdropFilter: 'blur(8px)',
        padding: '18px 32px 14px',
        flexShrink: 0,
        position: 'sticky',
        top: 0,
        zIndex: 10,
      }}>

        {/* Back + admin banner */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
          <Link href="/team" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}
            className="hover:text-white transition-colors">
            <ArrowLeft style={{ width: 13, height: 13 }} />
            Mi Equipo
          </Link>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{
              fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase',
              color: '#BA7517', background: 'rgba(186,117,23,0.08)',
              border: '1px solid rgba(186,117,23,0.2)', borderRadius: 4, padding: '3px 10px',
            }}>
              {isAdmin ? 'Admin' : 'Manager'} — {profile.full_name ?? profile.email}
            </span>
            {isAdmin && (
              <Link href={`/team/${userId}?tab=activities`} style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}
                className="hover:text-white transition-colors">
                Editar actividades →
              </Link>
            )}
          </div>
        </div>

        {/* Avatar + info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 14 }}>
          <Avatar name={profile.full_name} email={profile.email} avatarUrl={profile.avatar_url} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 5 }}>
              <h1 style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', margin: 0, lineHeight: 1.2 }}>
                {profile.full_name ?? profile.email}
              </h1>
              <span style={{
                fontSize: 10, fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
                color: status.color, background: status.bg, border: `1px solid ${status.border}`,
                borderRadius: 999, padding: '2px 10px',
              }}>
                {status.label}
              </span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                <Mail style={{ width: 11, height: 11 }} />{profile.email}
              </span>
              {profile.company && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  <Building2 style={{ width: 11, height: 11 }} />{profile.company}
                </span>
              )}
              {profile.last_seen_at && (
                <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  <Clock style={{ width: 11, height: 11 }} />
                  Último acceso: {formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true, locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Period selector */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <Suspense fallback={<div style={{ height: 30, width: 320, borderRadius: 6, background: 'rgba(255,255,255,0.04)' }} />}>
            <PeriodSelector />
          </Suspense>
          <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.22)' }}>
            {periodDisplayLabel}
          </span>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
        <div style={{ maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 28 }}>

          {/* ── KPI cards ──────────────────────────────────────────────────── */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>

            {/* Compliance */}
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d0d', padding: '18px 20px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                Cumplimiento
              </p>
              <p style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: semColor(periodPct), lineHeight: 1, margin: '0 0 5px' }}>
                {periodPct}%
              </p>
              <p style={{ fontSize: 11, fontVariantNumeric: 'tabular-nums', color: delta === 0 ? 'rgba(255,255,255,0.3)' : delta > 0 ? '#1D9E75' : '#E24B4A', margin: 0 }}>
                {delta === 0 ? '—' : delta > 0 ? `▲ ${delta}pp` : `▼ ${Math.abs(delta)}pp`} vs anterior
              </p>
            </div>

            {/* Actividades */}
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d0d', padding: '18px 20px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                Actividades
              </p>
              <p style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#ffffff', lineHeight: 1, margin: '0 0 5px' }}>
                {periodReal}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                / {periodGoal} meta del período
              </p>
            </div>

            {/* Pipeline abierto */}
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d0d', padding: '18px 20px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                Pipeline abierto
              </p>
              <p style={{ fontSize: 26, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#ffffff', lineHeight: 1, margin: '0 0 5px' }}>
                {fmtUSD(openAmount)}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                {fmtUSD(wonAmount)} cerrado en el período
              </p>
            </div>

            {/* Racha */}
            <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d0d', padding: '18px 20px' }}>
              <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                Check-ins
              </p>
              <p style={{ fontSize: 30, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: '#ffffff', lineHeight: 1, margin: '0 0 5px' }}>
                {streakDays}
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.3)', margin: 0 }}>
                días activos (últimos 30)
              </p>
            </div>
          </div>

          {/* ── Trend chart ────────────────────────────────────────────────── */}
          <div style={{ borderRadius: 10, border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d0d', padding: '20px 24px' }}>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 16px' }}>
              Tendencia — últimas 6 semanas
            </p>
            <TrendChart weeks={trendData} />
          </div>

          {/* ── Pipeline summary ───────────────────────────────────────────── */}
          {pipeRows.length > 0 && (
            <div className="rounded-lg border border-border bg-card p-6 space-y-5">
              {/* Header: título + meta inmediatamente debajo */}
              <div>
                <h3 className="text-base font-semibold text-foreground leading-tight">Pipeline — {periodDisplayLabel}</h3>
                {dashPipeline.monthlyGoal > 0 && (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Meta: <span className="text-foreground font-bold text-sm">${dashPipeline.monthlyGoal.toLocaleString('es-CO')}</span>
                  </p>
                )}
              </div>

              {/* Contadores: ganados / abiertos / perdidos */}
              <div className="flex items-start gap-8">
                <div className="flex flex-col gap-0.5">
                  <span className="text-3xl font-bold tabular-nums text-emerald-400">{dashPipeline.wonCount}</span>
                  <span className="text-[11px] font-semibold text-emerald-400/60 uppercase tracking-wider">Ganados</span>
                  <span className="text-sm font-semibold tabular-nums text-emerald-400/80">${dashPipeline.wonAmount.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-3xl font-bold tabular-nums text-amber-400">{dashPipeline.openCount}</span>
                  <span className="text-[11px] font-semibold text-amber-400/60 uppercase tracking-wider">Abiertos</span>
                  <span className="text-sm font-semibold tabular-nums text-amber-400/80">${dashPipeline.openAmount.toLocaleString('es-CO')}</span>
                </div>
                <div className="flex flex-col gap-0.5">
                  <span className="text-3xl font-bold tabular-nums text-red-400">{dashPipeline.lostCount}</span>
                  <span className="text-[11px] font-semibold text-red-400/60 uppercase tracking-wider">Perdidos</span>
                  {dashPipeline.lostAmount > 0 && (
                    <span className="text-sm font-semibold tabular-nums text-red-400/80">${dashPipeline.lostAmount.toLocaleString('es-CO')}</span>
                  )}
                </div>
              </div>

              {/* Etapas: 3 columnas compactas */}
              {Object.keys(dashPipeline.stageCounts).length > 0 && (
                <div className="grid grid-cols-3 gap-3 pt-4 border-t border-border/50">
                  {(['Reunión', 'Propuesta', 'Cierre'] as const).map((stage) => {
                    const count = dashPipeline.stageCounts[stage] ?? 0
                    const color = stage === 'Reunión' ? 'text-cyan-400' : stage === 'Propuesta' ? 'text-amber-400' : 'text-emerald-400'
                    const bg    = stage === 'Reunión' ? 'bg-cyan-400/5 border-cyan-400/15' : stage === 'Propuesta' ? 'bg-amber-400/5 border-amber-400/15' : 'bg-emerald-400/5 border-emerald-400/15'
                    return (
                      <div key={stage} className={`flex flex-col items-center gap-1 rounded-lg border py-3 ${bg}`}>
                        <span className={`text-2xl font-bold tabular-nums ${color}`}>{count}</span>
                        <span className={`text-[10px] font-semibold uppercase tracking-widest ${color} opacity-60`}>{stage}</span>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── Activity breakdown ─────────────────────────────────────────── */}
          {breakdownRows.length > 0 && (
            <ActivityBreakdownTable rows={breakdownRows} />
          )}

          {/* ── Coach Pro — último análisis ────────────────────────────────── */}
          <div style={{ borderRadius: 10, border: '1px solid #00D9FF', background: '#0a0a0a', padding: '24px 28px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: lastCoach ? 16 : 0 }}>
              <Sparkles style={{ width: 18, height: 18, color: '#00D9FF', flexShrink: 0 }} strokeWidth={1.5} />
              <p style={{ fontSize: 13, fontWeight: 600, color: '#ffffff', margin: 0, flex: 1 }}>
                Último Análisis Coach Pro
              </p>
              {lastCoach && (
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.35)' }}>
                  {coachWeekLabel}
                </span>
              )}
            </div>
            {lastCoach ? (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.72)', lineHeight: 1.75, whiteSpace: 'pre-line', margin: 0 }}>
                {lastCoach.message}
              </p>
            ) : (
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.28)', margin: '12px 0 0' }}>
                Sin análisis semanal generado para este usuario.
              </p>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}
