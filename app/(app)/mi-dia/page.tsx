import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { redirect } from 'next/navigation'
import {
  Phone, Mail, Share2, Video, Layers, Users2, MessageSquare,
  AlertTriangle, Target, ClipboardCheck, FlaskConical, ArrowRight,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { DateNavigator } from '@/components/dashboard/DateNavigator'
import { MiDiaBrief } from '@/components/mi-dia/MiDiaBrief'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getMiDiaData } from '@/lib/queries/mi-dia'
import type { MiDiaActivityPlan } from '@/lib/queries/mi-dia'
import type { SemaphoreColor } from '@/lib/types/common'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mi Día',
  description: 'Tu plan del día para llegar a la meta',
}

interface PageProps {
  searchParams: Promise<{ refDate?: string }>
}

const CHANNEL_ICONS: Record<string, typeof Phone> = {
  'Teléfono':   Phone,
  'Email':      Mail,
  'LinkedIn':   Share2,
  'Video':      Video,
  'Múltiple':   Layers,
  'Presencial': Users2,
}

const BAR_FILL: Record<SemaphoreColor, string> = {
  green:   'bg-emerald-400',
  yellow:  'bg-amber-400',
  red:     'bg-red-400',
  no_goal: 'bg-muted-foreground/40',
}
const TEXT_CLR: Record<SemaphoreColor, string> = {
  green:   'text-emerald-400',
  yellow:  'text-amber-400',
  red:     'text-red-400',
  no_goal: 'text-muted-foreground',
}
const BADGE_CLR: Record<SemaphoreColor, string> = {
  green:   'bg-emerald-400/10 text-emerald-400 border-emerald-400/25',
  yellow:  'bg-amber-400/10 text-amber-400 border-amber-400/25',
  red:     'bg-red-400/10 text-red-400 border-red-400/25',
  no_goal: 'bg-muted text-muted-foreground border-border',
}

function fmtUsd(n: number): string {
  return '$' + Math.round(n).toLocaleString('es-CO')
}

/** Fecha ISO → texto largo en español. UTC-noon evita el corrimiento de un día. */
function formatLongDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  const raw = new Intl.DateTimeFormat('es-CO', {
    timeZone: 'UTC', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  }).format(dt)
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function PlanCard({ p }: { p: MiDiaActivityPlan }) {
  const Icon = CHANNEL_ICONS[p.channel] ?? MessageSquare
  const pct = Math.min(100, p.goal > 0 ? (p.real / p.goal) * 100 : 0)
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted/40">
          <Icon className="h-4 w-4 text-muted-foreground" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-foreground">{p.name}</p>
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60">{p.channel}</p>
        </div>
        <div className="text-right">
          <span className={`font-mono text-lg font-bold tabular-nums ${TEXT_CLR[p.semaphore]}`}>{p.real}</span>
          <span className="font-mono text-sm text-muted-foreground"> / {p.goal}</span>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted/40">
        <div className={`h-full rounded-full ${BAR_FILL[p.semaphore]} transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

export default async function MiDiaPage({ searchParams }: PageProps) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const { refDate } = await searchParams
  const data = await getMiDiaData(sb, user.id, refDate)
  const fechaLarga = formatLongDate(data.refDate)

  // ── Estado vacío: sin recetario activo ──
  if (!data.hasScenario) {
    return (
      <div className="flex flex-col h-full">
        <TopBar title="Mi Día" description={fechaLarga} />
        <div className="flex flex-1 items-center justify-center p-8">
          <div className="max-w-md rounded-lg border border-border bg-card p-8 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10">
              <FlaskConical className="h-6 w-6 text-primary" />
            </div>
            <h2 className="text-lg font-bold text-foreground">Aún no tienes un recetario activo</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Crea tu recetario para que Mi Día calcule tu plan diario, tu ritmo de la semana y tu proyección al cierre.
            </p>
            <Link
              href="/recipe"
              className="mt-5 inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90"
            >
              Crear mi recetario <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>
    )
  }

  const weekBadge = (
    <span className={`rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${BADGE_CLR[data.weekSemaphore]}`}>
      {data.weekState}
    </span>
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Mi Día" description={fechaLarga} action={weekBadge} />

      <div className="flex-1 overflow-y-auto">
        {/* Navegación por día (calendario + flechas) */}
        <div className="flex items-center gap-3 border-b border-border bg-background px-6 py-3 lg:px-8">
          <Suspense>
            <DateNavigator period="daily" refDate={data.refDate} />
          </Suspense>
          {!data.isToday && (
            <span className="rounded-full border border-amber-400/30 bg-amber-400/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-amber-400">
              Vista histórica
            </span>
          )}
        </div>

        <div className="mx-auto max-w-4xl space-y-6 p-6 lg:p-8">

          {/* Brief del copiloto (async) — key fuerza recarga al cambiar de día */}
          <MiDiaBrief key={data.refDate} refDate={data.refDate} isToday={data.isToday} />

          {/* Plan del día */}
          <section>
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                {data.isToday ? 'Plan de hoy' : 'Plan del día'}
              </h2>
              <span className="font-mono text-xs tabular-nums text-muted-foreground">
                {data.todayReal} / {data.todayGoal} actividades
              </span>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {data.plan.map((p) => <PlanCard key={p.id} p={p} />)}
            </div>
          </section>

          {/* Acciones prioritarias */}
          <section>
            <h2 className="mb-3 text-[11px] font-bold uppercase tracking-[0.15em] text-muted-foreground">Acciones prioritarias</h2>
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              {data.alerts.length === 0 && (
                <div className="px-4 py-3 text-sm text-muted-foreground">
                  Ninguna oportunidad frenada — tu pipeline está al día. 🎯
                </div>
              )}
              {data.alerts.map((a) => (
                <Link
                  key={a.id}
                  href="/pipeline"
                  className="flex items-center gap-3 border-b border-border px-4 py-3 transition-colors last:border-b-0 hover:bg-muted/30"
                >
                  <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-foreground">{a.company}</p>
                    <p className="text-[11px] text-muted-foreground">
                      Sin movimiento hace <span className="font-semibold text-amber-400/90">{a.daysStale} días</span>
                    </p>
                  </div>
                  <span className="font-mono text-sm font-semibold tabular-nums text-foreground">{fmtUsd(a.amount)}</span>
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                </Link>
              ))}
              {/* Mensaje de recuperación de la semana */}
              {data.recovery && (
                <div className="flex items-center gap-3 border-t border-border bg-primary/[0.03] px-4 py-3">
                  <Target className="h-4 w-4 shrink-0 text-primary" />
                  <p className="text-sm text-foreground/90">
                    {data.recovery.unitsNeeded > 0 ? (
                      <>
                        Haz <span className="font-bold text-primary">{data.recovery.unitsNeeded}</span>{' '}
                        {data.recovery.activityName} más {data.isToday ? 'hoy' : 'ese día'} para cerrar la semana al 100%.
                      </>
                    ) : (
                      <>Vas al día en <span className="font-semibold text-primary">{data.recovery.activityName}</span> — mantén el ritmo.</>
                    )}
                  </p>
                </div>
              )}
            </div>
          </section>

          {/* Proyección del mes + check-in */}
          <section className="rounded-lg border border-border bg-card p-6">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                  Proyección de cierre del mes
                </p>
                <div className="mt-1 flex items-baseline gap-2">
                  <span className={`font-mono text-4xl font-bold tabular-nums ${TEXT_CLR[data.projectionSemaphore]}`}>
                    {data.projectionPct}%
                  </span>
                  <span className="text-xs text-muted-foreground">de tu meta mensual</span>
                </div>
                <p className="mt-1 text-[11px] text-muted-foreground/70">
                  Al ritmo actual de cierres · meta {fmtUsd(data.monthlyGoal)}
                </p>
              </div>
              <Link
                href="/checkin"
                className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition-all hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,217,255,0.25)]"
              >
                <ClipboardCheck className="h-4 w-4" />
                Registrar check-in
              </Link>
            </div>
          </section>

        </div>
      </div>
    </div>
  )
}
