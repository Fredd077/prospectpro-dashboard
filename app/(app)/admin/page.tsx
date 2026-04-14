import type { Metadata } from 'next'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import {
  Building2, UserCheck, Clock, Activity, TrendingUp, ExternalLink,
} from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { TopBar } from '@/components/layout/TopBar'
import { UsersTable } from '@/components/admin/UsersTable'
import { AdminFilters } from '@/components/admin/AdminFilters'
import { ReportModal } from '@/components/team/ReportModal'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils/dates'
import type { Profile } from '@/lib/types/database'

export const metadata: Metadata = { title: 'Command Center — ProspectPro' }

interface Props {
  searchParams: Promise<{ role?: string; company?: string }>
}

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
      {children}
    </p>
  )
}

function KpiCard({
  icon: Icon,
  label,
  value,
  topColor,
  valueColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number | string
  topColor: string
  valueColor?: string
}) {
  return (
    <div className={`rounded-lg border bg-card p-4 border-t-2 ${topColor}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">{label}</p>
          <p className={`mt-2 text-3xl font-bold font-data ${valueColor ?? 'text-foreground'}`}>{value}</p>
        </div>
        <Icon className="h-4 w-4 text-muted-foreground/40 mt-0.5" />
      </div>
    </div>
  )
}

export default async function AdminPage({ searchParams }: Props) {
  // Auth guard
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { role: filterRole = 'all', company: filterCompany = 'all' } = await searchParams

  const service  = getSupabaseServiceClient()
  const today    = todayISO()
  const sevenDaysAgo = new Date()
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)
  const weekAgo  = sevenDaysAgo.toISOString().slice(0, 10)
  const thirtyDaysAgo = new Date()
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
  const monthAgo = thirtyDaysAgo.toISOString().slice(0, 10)

  // ── Parallel fetches
  const [
    { data: allUsersRaw },
    { data: todayLogsRaw },
    { data: weekLogsRaw },
    { data: lastLogRaw },
  ] = await Promise.all([
    service
      .from('profiles')
      .select('id,full_name,email,company,role,org_role,manager_id,created_at,last_seen_at,avatar_url')
      .order('company', { ascending: true })
      .order('full_name', { ascending: true }),
    service
      .from('activity_logs')
      .select('user_id')
      .eq('log_date', today),
    service
      .from('activity_logs')
      .select('user_id')
      .gte('log_date', weekAgo)
      .lte('log_date', today),
    service
      .from('activity_logs')
      .select('user_id, log_date')
      .gte('log_date', monthAgo)
      .order('log_date', { ascending: false }),
  ])

  type BaseUser = { id: string; full_name: string | null; email: string; company: string | null; role: string; org_role: string | null; manager_id: string | null; created_at: string; last_seen_at: string | null; avatar_url: string | null }
  const users: Profile[] = ((allUsersRaw ?? []) as BaseUser[]).map((u) => ({
    ...u,
    role: u.role as Profile['role'],
    onboarding_completed: false,
    activated_at: null,
    activated_by: null,
    org_role: (u.org_role ?? null) as Profile['org_role'],
    manager_id: u.manager_id ?? null,
    is_player_coach: null,
  }))

  // ── Index sets
  const todayUserIds   = new Set((todayLogsRaw  ?? []).map((l) => l.user_id))
  const weekUserIds    = new Set((weekLogsRaw   ?? []).map((l) => l.user_id))

  // Last log date per user (from 30-day window)
  const lastLogByUser: Record<string, string> = {}
  for (const log of lastLogRaw ?? []) {
    if (!lastLogByUser[log.user_id]) lastLogByUser[log.user_id] = log.log_date as string
  }

  // ── Global KPIs
  const uniqueCompanies = new Set(users.map((u) => (u.company ?? '').toLowerCase().trim()).filter(Boolean)).size
  const totalActive     = users.filter((u) => u.role === 'active' || u.role === 'admin').length
  const totalPending    = users.filter((u) => u.role === 'pending').length
  const checkinsToday   = todayUserIds.size
  const activeThisWeek  = weekUserIds.size

  // ── Company aggregation (normalized key to merge same-company different-casing)
  const companyMap: Record<string, Profile[]> = {}
  const companyDisplayName: Record<string, string> = {}
  for (const u of users) {
    const key = (u.company ?? '').toLowerCase().trim() || '__none__'
    if (!companyMap[key]) {
      companyMap[key] = []
      companyDisplayName[key] = u.company ?? ''
    }
    companyMap[key].push(u)
  }

  type CompanyRow = {
    key: string
    name: string
    activeUsers: number
    managerCount: number
    checkinsToday: number
    activeThisWeek: number
    lastCheckin: string | null
  }

  const companyRows: CompanyRow[] = Object.entries(companyMap)
    .map(([key, members]) => {
      const activeMembers   = members.filter((u) => u.role === 'active' || u.role === 'admin')
      const checkins        = members.filter((u) => todayUserIds.has(u.id)).length
      const weekActive      = members.filter((u) => weekUserIds.has(u.id)).length
      const managerCount    = members.filter((u) => u.org_role === 'manager').length
      const lastDates       = members.map((u) => lastLogByUser[u.id]).filter(Boolean)
      const lastCheckin     = lastDates.sort().at(-1) ?? null
      return {
        key,
        name:           key === '__none__' ? 'Sin empresa asignada' : (companyDisplayName[key] ?? key),
        activeUsers:    activeMembers.length,
        managerCount,
        checkinsToday:  checkins,
        activeThisWeek: weekActive,
        lastCheckin,
      }
    })
    .sort((a, b) => {
      // Real companies first, "Sin empresa" last
      if (a.key === '__none__') return 1
      if (b.key === '__none__') return -1
      // Then by most check-ins today
      return b.checkinsToday - a.checkinsToday
    })

  // ── Company list for filters
  const companyList = ['all', ...Object.keys(companyMap).filter((k) => k !== '__none__').map((k) => companyDisplayName[k] ?? k).sort()]

  // ── Manager names for UsersTable
  const managerMap: Record<string, string> = {}
  for (const u of users) {
    if (u.org_role === 'manager') {
      managerMap[u.id] = u.full_name ?? u.email
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Command Center"
        description="Analítica global de ProspectPro SaaS"
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-10">

        {/* ── SECCIÓN 1: KPIs globales */}
        <div className="space-y-3">
          <SectionHeader>Plataforma</SectionHeader>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
            <KpiCard
              icon={Building2}  label="Empresas"              value={uniqueCompanies}
              topColor="border-t-primary/40"       valueColor="text-primary"
            />
            <KpiCard
              icon={UserCheck}  label="Usuarios activos"      value={totalActive}
              topColor="border-t-emerald-500/40"
            />
            <KpiCard
              icon={Clock}      label="Pendientes"             value={totalPending}
              topColor="border-t-amber-500/40"
              valueColor={totalPending > 0 ? 'text-amber-400' : undefined}
            />
            <KpiCard
              icon={Activity}   label="Check-ins hoy"          value={checkinsToday}
              topColor="border-t-cyan-500/40"
            />
            <KpiCard
              icon={TrendingUp} label="Activos esta semana"    value={activeThisWeek}
              topColor="border-t-violet-500/40"
            />
          </div>
        </div>

        {/* ── SECCIÓN 2: Reportes del equipo */}
        <div className="space-y-3">
          <SectionHeader>Reportes del equipo</SectionHeader>
          <ReportModal
            managerEmail={user.email ?? ''}
            showCompanyFilter
            companies={companyList.filter((c) => c !== 'all')}
            members={users
              .filter((u) => u.role === 'active' || u.role === 'admin')
              .map((u) => ({
                id:      u.id,
                name:    u.full_name ?? u.email,
                email:   u.email,
                company: u.company ?? '',
              }))}
          />
        </div>

        {/* ── SECCIÓN 3: Tabla por empresa */}
        <div className="space-y-3">
          <SectionHeader>Empresas en la plataforma</SectionHeader>
          <div className="rounded-lg border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Empresa
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden sm:table-cell">
                    Activos
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
                    Managers
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Check-ins hoy
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
                    Activos esta semana
                  </th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden xl:table-cell">
                    Último check-in
                  </th>
                  <th className="px-4 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {companyRows.map((row) => (
                  <tr key={row.key} className="hover:bg-muted/10 transition-colors">
                    <td className="px-4 py-2.5">
                      <span className={
                        row.key === '__none__'
                          ? 'text-xs text-muted-foreground/50 italic'
                          : 'text-xs font-medium text-primary'
                      }>
                        {row.name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs font-data text-foreground hidden sm:table-cell">
                      {row.activeUsers}
                    </td>
                    <td className="px-4 py-2.5 text-right hidden lg:table-cell">
                      {row.managerCount > 0 ? (
                        <span className="text-xs font-semibold text-primary">{row.managerCount}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.checkinsToday > 0 ? (
                        <span className="text-xs font-semibold text-emerald-400">{row.checkinsToday}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right hidden md:table-cell">
                      {row.activeThisWeek > 0 ? (
                        <span className="text-xs font-data text-foreground">{row.activeThisWeek}</span>
                      ) : (
                        <span className="text-xs text-muted-foreground/40">0</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 text-right text-xs text-muted-foreground font-data hidden xl:table-cell">
                      {row.lastCheckin
                        ? formatDistanceToNow(parseISO(row.lastCheckin), { addSuffix: true, locale: es })
                        : '—'}
                    </td>
                    <td className="px-4 py-2.5 text-right">
                      {row.key !== '__none__' && (
                        <Link
                          href={`/team?company=${encodeURIComponent(row.name)}`}
                          className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-primary hover:bg-muted/50 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          Ver equipo
                        </Link>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── SECCIÓN 3: Tabla de usuarios */}
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <SectionHeader>Usuarios</SectionHeader>
            <Suspense>
              <AdminFilters companies={companyList} />
            </Suspense>
          </div>
          <UsersTable
            users={users}
            filterRole={filterRole}
            filterCompany={filterCompany}
            managerMap={managerMap}
          />
        </div>

      </div>
    </div>
  )
}
