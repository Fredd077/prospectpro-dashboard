import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, Building2, Mail, Clock } from 'lucide-react'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { TeamUserTabs } from '@/components/team/TeamUserTabs'
import { TeamUserGoalEditor } from '@/components/team/TeamUserGoalEditor'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { startOfWeek, endOfWeek, parseISO, format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Perfil de usuario — ProspectPro' }

type Tab = 'dashboard' | 'activities' | 'coach'

interface Props {
  params:       Promise<{ userId: string }>
  searchParams: Promise<{ tab?: string }>
}

function Avatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl: string | null }) {
  const str    = name ?? email
  const parts  = str.split(/[\s@]/).filter(Boolean)
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : str.slice(0, 2).toUpperCase()

  return avatarUrl ? (
    <img src={avatarUrl} alt={name ?? email} className="h-14 w-14 rounded-full object-cover ring-2 ring-border shrink-0" />
  ) : (
    <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-primary/20 text-base font-bold text-primary ring-2 ring-border">
      {initials}
    </div>
  )
}

function complianceColor(pct: number) {
  if (pct >= 70) return 'text-emerald-400'
  if (pct >= 40) return 'text-amber-400'
  return 'text-red-400'
}

export default async function TeamUserPage({ params, searchParams }: Props) {
  const { userId }  = await params
  const { tab = 'dashboard' } = await searchParams
  const activeTab   = (['dashboard', 'activities', 'coach'] as Tab[]).includes(tab as Tab)
    ? (tab as Tab)
    : 'dashboard'

  // Auth check
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: myProfile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (myProfile?.role !== 'admin') redirect('/dashboard')

  const service = getSupabaseServiceClient()

  // Fetch target user profile
  const { data: profile } = await service
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single()

  if (!profile) notFound()

  const today     = todayISO()
  const todayDate = parseISO(today)
  const weekStart = toISODate(startOfWeek(todayDate, { weekStartsOn: 1 }))
  const weekEnd   = toISODate(endOfWeek(todayDate,   { weekStartsOn: 1 }))

  // ── Tab: Dashboard ───────────────────────────────────────────
  let dashData: {
    weeklyReal: number; weeklyGoal: number; weeklyCompliance: number
    totalActivities: number; streak: number
    activityRows: { name: string; channel: string; real: number; goal: number; pct: number }[]
  } | null = null

  if (activeTab === 'dashboard') {
    const [logsRes, activitiesRes] = await Promise.all([
      service.from('activity_logs').select('activity_id,real_executed,day_goal')
        .eq('user_id', userId).gte('log_date', weekStart).lte('log_date', weekEnd),
      service.from('activities').select('id,name,channel,weekly_goal')
        .eq('user_id', userId).eq('status', 'active'),
    ])

    const logs       = logsRes.data ?? []
    const activities = activitiesRes.data ?? []

    const realByActivity: Record<string, number> = {}
    for (const log of logs) {
      realByActivity[log.activity_id] = (realByActivity[log.activity_id] ?? 0) + log.real_executed
    }

    const weeklyReal = logs.reduce((s, l) => s + l.real_executed, 0)
    const weeklyGoal = activities.reduce((s, a) => s + a.weekly_goal, 0)
    const weeklyCompliance = weeklyGoal > 0 ? Math.round((weeklyReal / weeklyGoal) * 100) : 0

    // Streak: count distinct log_dates in last 14 days
    const past14 = toISODate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))
    const { data: streakLogs } = await service
      .from('activity_logs').select('log_date')
      .eq('user_id', userId).gte('log_date', past14)
    const uniqueDates = new Set(streakLogs?.map((l) => l.log_date) ?? [])
    const streak = uniqueDates.size

    const activityRows = activities.map((a) => {
      const real = realByActivity[a.id] ?? 0
      const goal = a.weekly_goal
      return { name: a.name, channel: a.channel, real, goal, pct: goal > 0 ? Math.round((real / goal) * 100) : 0 }
    }).sort((a, b) => b.pct - a.pct)

    dashData = { weeklyReal, weeklyGoal, weeklyCompliance, totalActivities: activities.length, streak, activityRows }
  }

  // ── Tab: Activities ──────────────────────────────────────────
  let activitiesForEdit: {
    id: string; name: string; channel: string; type: 'OUTBOUND' | 'INBOUND'
    monthly_goal: number; weekly_goal: number; daily_goal: number
    status: 'active' | 'inactive'
  }[] = []

  if (activeTab === 'activities') {
    const { data } = await service
      .from('activities').select('id,name,channel,type,monthly_goal,weekly_goal,daily_goal,status')
      .eq('user_id', userId).order('status').order('sort_order').order('name')
    activitiesForEdit = (data ?? []) as typeof activitiesForEdit
  }

  // ── Tab: Coach ───────────────────────────────────────────────
  let coachMessages: {
    id: string; type: string; message: string; period_date: string
    context: Record<string, unknown> | null; user_comment: string | null; created_at: string
  }[] = []

  if (activeTab === 'coach') {
    const { data } = await service
      .from('coach_messages').select('id,type,message,period_date,context,user_comment,created_at')
      .eq('user_id', userId).order('period_date', { ascending: false }).order('created_at', { ascending: false })
      .limit(50)
    coachMessages = (data ?? []).map((m) => ({ ...m, context: m.context as Record<string, unknown> | null }))
  }

  const weekLabel = `${format(parseISO(weekStart), 'd MMM', { locale: es })} – ${format(parseISO(weekEnd), 'd MMM yyyy', { locale: es })}`

  return (
    <div className="flex flex-col h-full">
      {/* Sticky header */}
      <div className="border-b border-border bg-card/80 backdrop-blur-sm px-8 pt-5 pb-0 space-y-4 shrink-0">
        {/* Back + admin banner */}
        <div className="flex items-center justify-between gap-4">
          <Link href="/team" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="h-3.5 w-3.5" />
            Mi Equipo
          </Link>
          <div className="flex items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-1.5">
            <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wider">
              Viendo como admin — datos de {profile.full_name ?? profile.email}
            </span>
          </div>
        </div>

        {/* User info */}
        <div className="flex items-start gap-4">
          <Avatar name={profile.full_name} email={profile.email} avatarUrl={profile.avatar_url} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-lg font-bold text-foreground">{profile.full_name ?? profile.email}</h1>
              <span className={cn(
                'text-[10px] font-semibold px-1.5 py-0.5 rounded border',
                profile.role === 'active' || profile.role === 'admin'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                  : 'bg-muted text-muted-foreground border-border'
              )}>
                {profile.role === 'admin' ? 'Admin' : profile.role === 'active' ? 'Activo' : 'Inactivo'}
              </span>
            </div>
            <div className="flex items-center gap-4 mt-1 flex-wrap text-[11px] text-muted-foreground">
              <span className="flex items-center gap-1"><Mail className="h-3 w-3" />{profile.email}</span>
              {profile.company && <span className="flex items-center gap-1"><Building2 className="h-3 w-3" />{profile.company}</span>}
              {profile.last_seen_at && (
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  Último acceso: {formatDistanceToNow(new Date(profile.last_seen_at), { addSuffix: true, locale: es })}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <TeamUserTabs activeTab={activeTab} userId={userId} />
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto p-8">

        {/* ── DASHBOARD TAB ───────────────────────────────── */}
        {activeTab === 'dashboard' && dashData && (
          <div className="space-y-6 max-w-3xl">
            <p className="text-xs text-muted-foreground">Semana: <span className="text-foreground font-medium">{weekLabel}</span></p>

            {/* KPI cards */}
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              {[
                { label: 'Cumplimiento',   value: `${dashData.weeklyCompliance}%`, sub: 'esta semana', highlight: complianceColor(dashData.weeklyCompliance) },
                { label: 'Actividades',    value: `${dashData.weeklyReal}`,        sub: `/ ${dashData.weeklyGoal} meta` },
                { label: 'Check-ins (14d)',value: `${dashData.streak}`,            sub: 'días con actividad' },
                { label: 'Actividades',    value: `${dashData.totalActivities}`,   sub: 'configuradas' },
              ].map(({ label, value, sub, highlight }) => (
                <div key={label} className="rounded-lg border border-border bg-card p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className={cn('mt-1.5 text-2xl font-bold font-data', highlight ?? 'text-foreground')}>{value}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Activity breakdown */}
            {dashData.activityRows.length > 0 && (
              <div className="rounded-lg border border-border bg-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actividad</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Real</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meta sem.</th>
                      <th className="px-4 py-3 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">%</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {dashData.activityRows.map((row) => (
                      <tr key={row.name} className="hover:bg-muted/20 transition-colors">
                        <td className="px-4 py-2.5">
                          <p className="text-xs font-medium text-foreground">{row.name}</p>
                          <p className="text-[10px] text-muted-foreground">{row.channel}</p>
                        </td>
                        <td className="px-4 py-2.5 text-right text-xs font-data font-semibold text-foreground">{row.real}</td>
                        <td className="px-4 py-2.5 text-right text-xs font-data text-muted-foreground">{row.goal}</td>
                        <td className="px-4 py-2.5 text-right">
                          <span className={cn('text-xs font-data font-bold', complianceColor(row.pct))}>
                            {row.pct}%
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── ACTIVITIES TAB ──────────────────────────────── */}
        {activeTab === 'activities' && (
          <div className="max-w-3xl">
            <p className="text-sm text-muted-foreground mb-6">
              Edita las metas mensuales de cada actividad. Los valores semanales y diarios se recalculan automáticamente.
            </p>
            {activitiesForEdit.length === 0 ? (
              <p className="text-sm text-muted-foreground">Este usuario aún no tiene actividades configuradas.</p>
            ) : (
              <TeamUserGoalEditor activities={activitiesForEdit} userId={userId} />
            )}
          </div>
        )}

        {/* ── COACH TAB ───────────────────────────────────── */}
        {activeTab === 'coach' && (
          <div className="max-w-3xl space-y-4">
            {coachMessages.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay reportes Coach IA para este usuario.</p>
            ) : (
              coachMessages.map((msg) => {
                const TYPE_LABELS: Record<string, { label: string; cls: string }> = {
                  daily:   { label: 'DIARIO',   cls: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
                  weekly:  { label: 'SEMANAL',  cls: 'bg-violet-500/10 text-violet-400 border-violet-500/20' },
                  monthly: { label: 'MENSUAL',  cls: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
                }
                const badge = TYPE_LABELS[msg.type] ?? TYPE_LABELS.daily
                let periodLabel = msg.period_date
                try {
                  const d = parseISO(msg.period_date)
                  if (msg.type === 'daily')   periodLabel = format(d, "EEEE d 'de' MMMM yyyy", { locale: es })
                  if (msg.type === 'weekly') {
                    const end = new Date(d); end.setDate(d.getDate() + 6)
                    periodLabel = `Semana del ${format(d, 'd', { locale: es })} al ${format(end, "d 'de' MMMM yyyy", { locale: es })}`
                  }
                  if (msg.type === 'monthly') periodLabel = format(d, "MMMM yyyy", { locale: es })
                } catch { /* keep raw */ }

                return (
                  <div key={msg.id} className="rounded-lg border border-border bg-card p-5 space-y-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={cn('text-[10px] font-semibold px-2 py-0.5 rounded border', badge.cls)}>{badge.label}</span>
                      <span className="text-[11px] text-muted-foreground">📅 <span className="capitalize">{periodLabel}</span></span>
                    </div>
                    <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{msg.message}</p>
                    {msg.user_comment && (
                      <div className="rounded border border-border/50 bg-muted/20 px-3 py-2">
                        <p className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Comentario del usuario</p>
                        <p className="text-xs text-foreground">{msg.user_comment}</p>
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">
                      Generado el {format(new Date(msg.created_at), "d 'de' MMMM yyyy 'a las' HH:mm", { locale: es })}
                    </p>
                  </div>
                )
              })
            )}
          </div>
        )}
      </div>
    </div>
  )
}
