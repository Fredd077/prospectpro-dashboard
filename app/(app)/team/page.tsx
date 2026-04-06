import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { Users, TrendingUp, CheckSquare, Target, Flame, ArrowRight } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { TeamFilters } from '@/components/team/TeamFilters'
import { TeamMemberFilter } from '@/components/team/TeamMemberFilter'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO, toISODate } from '@/lib/utils/dates'
import { startOfWeek, endOfWeek, parseISO, format, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

export const metadata: Metadata = { title: 'Mi Equipo — ProspectPro' }

interface Props {
  searchParams: Promise<{ search?: string; company?: string; status?: string; sort?: string; users?: string }>
}

function complianceColor(pct: number) {
  if (pct >= 70) return 'text-emerald-400'
  if (pct >= 40) return 'text-amber-400'
  return 'text-red-400'
}

function complianceBarColor(pct: number) {
  if (pct >= 70) return 'bg-emerald-400'
  if (pct >= 40) return 'bg-amber-400'
  return 'bg-red-400'
}

function complianceDot(pct: number) {
  if (pct >= 70) return '🟢'
  if (pct >= 40) return '🟡'
  return '🔴'
}

function Avatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl: string | null }) {
  const str    = name ?? email
  const parts  = str.split(/[\s@]/).filter(Boolean)
  const initials = parts.length >= 2
    ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
    : str.slice(0, 2).toUpperCase()

  return avatarUrl ? (
    <img src={avatarUrl} alt={name ?? email} className="h-10 w-10 rounded-full object-cover shrink-0" />
  ) : (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
      {initials}
    </div>
  )
}

export default async function TeamPage({ searchParams }: Props) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const { data: myProfile } = await sb
    .from('profiles')
    .select('role, org_role, company')
    .eq('id', user.id)
    .single()

  const isAdmin   = myProfile?.role === 'admin'
  const isManager = myProfile?.org_role === 'manager'

  if (!isAdmin && !isManager) redirect('/dashboard')
  if (isManager && !myProfile?.company) redirect('/dashboard')

  const params         = await searchParams
  const searchQ        = (params.search ?? '').toLowerCase()
  const companyFilter  = params.company ?? ''
  const statusFilter   = params.status  ?? ''
  const sortBy         = params.sort    ?? 'compliance'
  const usersParam     = params.users   ?? ''
  const selectedUserIds = usersParam ? usersParam.split(',').filter(Boolean) : []

  const today     = todayISO()
  const todayDate = parseISO(today)
  const weekStart = toISODate(startOfWeek(todayDate, { weekStartsOn: 1 }))
  const weekEnd   = toISODate(endOfWeek(todayDate,   { weekStartsOn: 1 }))
  const past14    = toISODate(new Date(Date.now() - 14 * 24 * 60 * 60 * 1000))

  const service = getSupabaseServiceClient()

  // ── Fetch team members
  let profilesQuery = service
    .from('profiles')
    .select('id,full_name,email,avatar_url,company,last_seen_at,role')
    .order('full_name', { ascending: true })

  if (isAdmin) {
    profilesQuery = profilesQuery.in('role', ['active', 'admin'])
  } else {
    // Manager sees everyone at the same company (excluding themselves)
    profilesQuery = profilesQuery
      .in('role', ['active', 'admin'])
      .eq('company', myProfile!.company as string)
      .neq('id', user.id)
  }

  const { data: profiles } = await profilesQuery

  const allUsers = profiles ?? []
  const userIds  = allUsers.map((u) => u.id)

  let weekLogs: { user_id: string; real_executed: number }[] = []
  let activitiesData: { user_id: string; weekly_goal: number }[] = []
  let recentLogs: { user_id: string; log_date: string }[] = []
  let recipesData: { user_id: string }[] = []

  if (userIds.length > 0) {
    const [wl, ad, rl, rd] = await Promise.all([
      service.from('activity_logs').select('user_id,real_executed')
        .gte('log_date', weekStart).lte('log_date', weekEnd).in('user_id', userIds),
      service.from('activities').select('user_id,weekly_goal')
        .eq('status', 'active').in('user_id', userIds),
      service.from('activity_logs').select('user_id,log_date')
        .gte('log_date', past14).in('user_id', userIds)
        .order('log_date', { ascending: false }),
      service.from('recipe_scenarios').select('user_id')
        .eq('is_active', true).in('user_id', userIds),
    ])
    weekLogs       = wl.data ?? []
    activitiesData = ad.data ?? []
    recentLogs     = rl.data ?? []
    recipesData    = rd.data ?? []
  }

  // ── Aggregate per user
  const weekRealByUser:  Record<string, number>  = {}
  const weekGoalByUser:  Record<string, number>  = {}
  const lastCheckInByUser: Record<string, string> = {}
  const streakDates: Record<string, Set<string>> = {}
  const recipeUserIds = new Set(recipesData.map((r) => r.user_id))

  for (const log of weekLogs) {
    weekRealByUser[log.user_id] = (weekRealByUser[log.user_id] ?? 0) + log.real_executed
  }
  for (const act of activitiesData) {
    weekGoalByUser[act.user_id] = (weekGoalByUser[act.user_id] ?? 0) + act.weekly_goal
  }
  for (const log of recentLogs) {
    if (!lastCheckInByUser[log.user_id]) lastCheckInByUser[log.user_id] = log.log_date
    if (!streakDates[log.user_id]) streakDates[log.user_id] = new Set()
    streakDates[log.user_id].add(log.log_date)
  }

  const teamUsers = allUsers.map((u) => {
    const real = weekRealByUser[u.id] ?? 0
    const goal = weekGoalByUser[u.id] ?? 0
    const pct  = goal > 0 ? Math.round((real / goal) * 100) : 0
    return {
      ...u,
      weeklyReal:       real,
      weeklyGoal:       goal,
      weeklyCompliance: pct,
      lastCheckIn:      lastCheckInByUser[u.id] ?? null,
      streak:           streakDates[u.id]?.size ?? 0,
      hasRecipe:        recipeUserIds.has(u.id),
    }
  })

  // ── Apply users filter (managers only)
  const baseUsers = (isManager && selectedUserIds.length > 0)
    ? teamUsers.filter((u) => selectedUserIds.includes(u.id))
    : teamUsers

  // ── Apply TeamFilters params
  let filtered = baseUsers.filter((u) => {
    if (searchQ && !u.full_name?.toLowerCase().includes(searchQ) && !u.email.toLowerCase().includes(searchQ)) return false
    if (isAdmin && companyFilter && u.company !== companyFilter) return false
    if (statusFilter === 'ontrack')  return u.weeklyCompliance >= 70
    if (statusFilter === 'atrisk')   return u.weeklyCompliance >= 40 && u.weeklyCompliance < 70
    if (statusFilter === 'critical') return u.weeklyCompliance < 40
    return true
  })

  // ── Sort
  if (sortBy === 'compliance') filtered.sort((a, b) => b.weeklyCompliance - a.weeklyCompliance)
  else if (sortBy === 'activities') filtered.sort((a, b) => b.weeklyReal - a.weeklyReal)
  else if (sortBy === 'checkin') filtered.sort((a, b) => {
    if (!a.lastCheckIn) return 1
    if (!b.lastCheckIn) return -1
    return b.lastCheckIn.localeCompare(a.lastCheckIn)
  })

  // ── Summary metrics (always based on full team, not filtered selection)
  const totalActive   = teamUsers.length
  const avgCompliance = totalActive > 0
    ? Math.round(teamUsers.reduce((s, u) => s + u.weeklyCompliance, 0) / totalActive)
    : 0
  const usersOnTrack  = teamUsers.filter((u) => u.weeklyCompliance >= 70).length
  const checkinsToday = teamUsers.filter((u) => u.lastCheckIn === today).length

  const companies  = [...new Set(allUsers.map((u) => u.company).filter(Boolean) as string[])].sort()
  const weekLabel  = `${format(parseISO(weekStart), 'd MMM', { locale: es })} – ${format(parseISO(weekEnd), 'd MMM yyyy', { locale: es })}`

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Mi Equipo" description="Monitorea el desempeño de tu equipo" />
      <div className="flex-1 overflow-y-auto p-8 space-y-6">

        {/* Manager banner */}
        {isManager && (
          <div className="flex items-center gap-2 rounded-lg border border-cyan-500/20 bg-cyan-500/5 px-4 py-2.5 text-xs text-cyan-400">
            <Users className="h-3.5 w-3.5 shrink-0" />
            Viendo analítica de tu equipo —{' '}
            <span className="font-semibold">{myProfile!.company}</span>
            {' · '}
            <span className="font-semibold">{totalActive} {totalActive === 1 ? 'miembro' : 'miembros'}</span>
          </div>
        )}

        {/* Summary cards */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          {[
            { icon: Users,      label: 'Usuarios activos',      value: `${totalActive}`,                       color: 'border-t-primary/40'     },
            { icon: TrendingUp, label: 'Cumplimiento promedio',  value: `${avgCompliance}%`,                    color: 'border-t-cyan-500/40'    },
            { icon: Target,     label: 'En meta (≥70%)',          value: `${usersOnTrack}/${totalActive}`,       color: 'border-t-emerald-500/40' },
            { icon: CheckSquare,label: 'Check-ins hoy',           value: `${checkinsToday}`,                     color: 'border-t-amber-500/40'   },
          ].map(({ icon: Icon, label, value, color }) => (
            <div key={label} className={`rounded-lg border bg-card p-4 border-t-2 ${color}`}>
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
                  <p className="mt-1.5 text-2xl font-bold font-data text-foreground">{value}</p>
                </div>
                <Icon className="h-4 w-4 text-muted-foreground/50 mt-0.5" />
              </div>
            </div>
          ))}
        </div>

        {/* Period label */}
        <p className="text-xs text-muted-foreground">
          Semana actual: <span className="text-foreground font-medium">{weekLabel}</span>
        </p>

        {/* Member filter (managers only) */}
        {isManager && allUsers.length > 1 && (
          <Suspense>
            <TeamMemberFilter
              members={allUsers.map((u) => ({ id: u.id, full_name: u.full_name, email: u.email }))}
              selectedIds={selectedUserIds}
            />
          </Suspense>
        )}

        {/* Filters */}
        <Suspense>
          <TeamFilters
            companies={companies}
            currentCompany={companyFilter}
            currentStatus={statusFilter}
            currentSort={sortBy}
            showCompany={isAdmin}
          />
        </Suspense>

        {/* Team cards */}
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-48 rounded-lg border border-dashed border-border">
            <p className="text-sm text-muted-foreground">No hay usuarios que coincidan con los filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {filtered.map((u) => (
              <div
                key={u.id}
                className="rounded-xl border border-border bg-card p-5 space-y-4 hover:border-primary/30 transition-colors"
              >
                {/* Header */}
                <div className="flex items-start gap-3">
                  <Avatar name={u.full_name} email={u.email} avatarUrl={u.avatar_url} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">
                      {u.full_name ?? u.email}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">
                      {[u.company, u.email].filter(Boolean).join(' · ')}
                    </p>
                    <p className="text-[10px] text-muted-foreground/60 mt-0.5">
                      {u.lastCheckIn
                        ? `Último check-in: ${formatDistanceToNow(parseISO(u.lastCheckIn), { addSuffix: true, locale: es })}`
                        : 'Sin check-ins recientes'}
                    </p>
                  </div>
                  <span className="text-base shrink-0">{complianceDot(u.weeklyCompliance)}</span>
                </div>

                {/* Compliance bar */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground">Cumplimiento semanal</span>
                    <span className={cn('text-sm font-bold font-data', complianceColor(u.weeklyCompliance))}>
                      {u.weeklyCompliance}%
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn('h-full rounded-full transition-all duration-700', complianceBarColor(u.weeklyCompliance))}
                      style={{ width: `${Math.min(u.weeklyCompliance, 100)}%` }}
                    />
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-4 text-xs">
                  <div>
                    <span className="text-muted-foreground">Actividades: </span>
                    <span className="font-semibold font-data text-foreground">
                      {u.weeklyReal}
                      {u.weeklyGoal > 0 && <span className="text-muted-foreground font-normal"> / {u.weeklyGoal}</span>}
                    </span>
                  </div>
                  {u.streak > 0 && (
                    <div className="flex items-center gap-1 text-amber-400">
                      <Flame className="h-3 w-3" />
                      <span className="font-semibold font-data">{u.streak}</span>
                      <span className="text-muted-foreground">días</span>
                    </div>
                  )}
                  <div className="ml-auto">
                    <span className={cn(
                      'text-[10px] font-medium',
                      u.hasRecipe ? 'text-emerald-400' : 'text-muted-foreground/50'
                    )}>
                      {u.hasRecipe ? '✅ Recetario' : '⚪ Sin recetario'}
                    </span>
                  </div>
                </div>

                {/* Link */}
                <Link
                  href={`/team/${u.id}`}
                  className="flex items-center justify-end gap-1 text-[11px] font-medium text-primary/70 hover:text-primary transition-colors"
                >
                  Ver perfil
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
