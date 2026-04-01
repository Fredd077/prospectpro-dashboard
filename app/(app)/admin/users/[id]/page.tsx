import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ChevronLeft, Building2, Mail, Calendar, Clock, Activity } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { UserActions } from '@/components/admin/UserActions'
import { CompanyCell } from '@/components/admin/CompanyCell'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { cn } from '@/lib/utils'
import type { Profile } from '@/lib/types/database'

interface Props {
  params: Promise<{ id: string }>
}

const ROLE_BADGE: Record<Profile['role'], { label: string; cls: string }> = {
  pending:  { label: 'Pendiente', cls: 'bg-warning/10 text-warning border border-warning/20' },
  active:   { label: 'Activo',    cls: 'bg-success/10 text-success border border-success/20' },
  inactive: { label: 'Inactivo',  cls: 'bg-muted text-muted-foreground border border-border' },
  admin:    { label: 'Admin',     cls: 'bg-primary/10 text-primary border border-primary/20' },
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ComponentType<{ className?: string }>; label: string; value: string }) {
  return (
    <div className="flex items-center gap-3 py-2.5 border-b border-border/50 last:border-0">
      <Icon className="h-4 w-4 text-muted-foreground/50 shrink-0" />
      <span className="text-xs text-muted-foreground w-28 shrink-0">{label}</span>
      <span className="text-sm text-foreground">{value}</span>
    </div>
  )
}

export default async function AdminUserDetailPage({ params }: Props) {
  // Auth check
  const sb = await getSupabaseServerClient()
  const { data: { user: admin } } = await sb.auth.getUser()
  if (!admin) redirect('/login')
  const { data: adminProfile } = await sb.from('profiles').select('role').eq('id', admin.id).single()
  if (adminProfile?.role !== 'admin') redirect('/dashboard')

  const { id } = await params
  const service = getSupabaseServiceClient()

  const [
    { data: profile },
    { data: activities },
    { count: totalCheckins },
    { data: recentLogs },
    { data: scenarios },
  ] = await Promise.all([
    service.from('profiles').select('*').eq('id', id).single(),
    service.from('activities').select('*').eq('user_id', id).order('sort_order'),
    service.from('activity_logs').select('id', { count: 'exact', head: true }).eq('user_id', id),
    service
      .from('activity_logs')
      .select('log_date, real_executed, activity_id')
      .eq('user_id', id)
      .order('log_date', { ascending: false })
      .limit(7),
    service.from('recipe_scenarios').select('*').eq('user_id', id).eq('is_active', true).limit(1),
  ])

  if (!profile) notFound()

  const badge = ROLE_BADGE[profile.role]
  const activeScenario = scenarios?.[0] ?? null

  function formatDate(iso: string | null) {
    if (!iso) return '—'
    return new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' })
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={profile.full_name ?? profile.email}
        description={profile.email}
        action={
          <Link href="/admin" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver al Admin
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        {/* Profile card */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-1 space-y-4">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              {/* Avatar + role */}
              <div className="flex items-center gap-3">
                {profile.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="h-12 w-12 rounded-full object-cover" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary">
                    {(profile.full_name ?? profile.email).slice(0, 2).toUpperCase()}
                  </div>
                )}
                <div>
                  <p className="font-semibold text-foreground">{profile.full_name ?? '—'}</p>
                  <span className={cn('rounded px-1.5 py-0.5 text-[10px] font-medium', badge.cls)}>
                    {badge.label}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div>
                <InfoRow icon={Mail}     label="Email"         value={profile.email} />
                <div className="flex items-center gap-3 py-2.5 border-b border-border/50">
                  <Building2 className="h-4 w-4 text-muted-foreground/50 shrink-0" />
                  <span className="text-xs text-muted-foreground w-28 shrink-0">Empresa</span>
                  <CompanyCell userId={profile.id} initialValue={profile.company ?? null} />
                </div>
                <InfoRow icon={Calendar} label="Registrado"    value={formatDate(profile.created_at)} />
                <InfoRow icon={Clock}    label="Último acceso" value={formatDate(profile.last_seen_at)} />
                <InfoRow icon={Activity} label="Check-ins"     value={String(totalCheckins ?? 0)} />
              </div>

              {/* Actions */}
              {profile.role !== 'admin' && (
                <div className="pt-2">
                  <UserActions user={profile} />
                </div>
              )}
            </div>

            {/* Active scenario */}
            {activeScenario && (
              <div className="rounded-lg border border-border bg-card p-5 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Escenario activo
                </p>
                <p className="text-sm font-medium text-foreground">{activeScenario.name}</p>
                <div className="space-y-1.5">
                  {[
                    { label: 'Meta mensual', value: `$${activeScenario.monthly_revenue_goal.toLocaleString('es-CO')}` },
                    { label: 'Ticket promedio', value: `$${activeScenario.average_ticket.toLocaleString('es-CO')}` },
                    { label: 'Actividades/mes', value: String(activeScenario.activities_needed_monthly ?? '—') },
                  ].map(({ label, value }) => (
                    <div key={label} className="flex justify-between text-xs">
                      <span className="text-muted-foreground">{label}</span>
                      <span className="font-data text-foreground">{value}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Activities configured */}
          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Actividades configuradas ({activities?.length ?? 0})
              </p>
              {activities && activities.length > 0 ? (
                <div className="space-y-2">
                  {activities.map((act) => (
                    <div key={act.id} className="flex items-center justify-between py-2 border-b border-border/40 last:border-0">
                      <div>
                        <p className="text-sm font-medium text-foreground">{act.name}</p>
                        <p className="text-[10px] text-muted-foreground">{act.type} · {act.channel}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-sm font-data text-foreground">{act.monthly_goal}/mes</p>
                        <p className="text-[10px] text-muted-foreground">{act.daily_goal}/día</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin actividades configuradas.</p>
              )}
            </div>

            {/* Recent logs */}
            <div className="rounded-lg border border-border bg-card p-5 space-y-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Últimos 7 registros
              </p>
              {recentLogs && recentLogs.length > 0 ? (
                <div className="space-y-1.5">
                  {recentLogs.map((log, i) => {
                    const act = activities?.find((a) => a.id === log.activity_id)
                    return (
                      <div key={i} className="flex items-center justify-between text-xs py-1.5 border-b border-border/30 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="font-data text-muted-foreground">{log.log_date}</span>
                          <span className="text-foreground">{act?.name ?? '—'}</span>
                        </div>
                        <span className="font-data font-semibold text-primary">{log.real_executed}</span>
                      </div>
                    )
                  })}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">Sin registros recientes.</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
