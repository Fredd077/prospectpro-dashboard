import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Users, UserCheck, Clock, Activity, BarChart2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { UsersTable } from '@/components/admin/UsersTable'
import { AdminFilters } from '@/components/admin/AdminFilters'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { Suspense } from 'react'

export const metadata: Metadata = { title: 'Admin Panel — ProspectPro' }

interface Props {
  searchParams: Promise<{ role?: string }>
}

function MetricCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: number
  color: string
}) {
  return (
    <div className={`rounded-lg border bg-card p-5 border-t-2 ${color}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            {label}
          </p>
          <p className="mt-2 text-3xl font-bold font-data text-foreground">{value}</p>
        </div>
        <Icon className="h-5 w-5 text-muted-foreground/50" />
      </div>
    </div>
  )
}

export default async function AdminPage({ searchParams }: Props) {
  // Auth check
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/dashboard')

  const { role: filterRole = 'all' } = await searchParams

  // Fetch all data via service role (bypasses RLS)
  const service = getSupabaseServiceClient()

  const [
    { data: users },
    { count: checkinsToday },
    { count: totalLogs },
  ] = await Promise.all([
    service.from('profiles').select('*').order('created_at', { ascending: false }),
    service
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('log_date', new Date().toISOString().slice(0, 10)),
    service.from('activity_logs').select('id', { count: 'exact', head: true }),
  ])

  const allUsers = users ?? []
  const totalUsers = allUsers.length
  const activeUsers = allUsers.filter((u) => u.role === 'active').length
  const pendingUsers = allUsers.filter((u) => u.role === 'pending').length

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Admin Panel"
        description="Gestión de usuarios y métricas globales de ProspectPro"
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-8">
        {/* Global metrics */}
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <MetricCard icon={Users}     label="Total usuarios"  value={totalUsers}    color="border-t-primary/40" />
          <MetricCard icon={UserCheck} label="Activos"         value={activeUsers}   color="border-t-success/40" />
          <MetricCard icon={Clock}     label="Pendientes"      value={pendingUsers}  color="border-t-warning/40" />
          <MetricCard icon={Activity}  label="Check-ins hoy"   value={checkinsToday ?? 0} color="border-t-chart-5/40" />
        </div>

        {/* Users table */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h2 className="text-sm font-semibold text-foreground">Usuarios registrados</h2>
            <Suspense>
              <AdminFilters />
            </Suspense>
          </div>
          <UsersTable users={allUsers} filterRole={filterRole} />
        </div>
      </div>
    </div>
  )
}
