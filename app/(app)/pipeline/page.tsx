import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { PipelineFunnelSummary } from '@/components/pipeline/PipelineFunnelSummary'
import { PipelineEntriesTable } from '@/components/pipeline/PipelineEntriesTable'
import { PipelineNewEntryModal } from '@/components/pipeline/PipelineNewEntryModal'
import { DateNavigator } from '@/components/dashboard/DateNavigator'
import { KanbanBoard } from '@/components/pipeline/KanbanBoard'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getPeriodRange, todayISO, periodLabel } from '@/lib/utils/dates'
import {
  calcRealConversions,
  calcPipelineValue,
  scalePlanToperiod,
} from '@/lib/calculations/pipeline'
import {
  calcRecipe,
  DEFAULT_FUNNEL_STAGES,
  DEFAULT_OUTBOUND_RATES,
  DEFAULT_INBOUND_RATES,
} from '@/lib/calculations/recipe'
import type { PeriodType } from '@/lib/types/common'
import type { Deal } from '@/lib/types/database'

export const metadata: Metadata = {
  title: 'Mi Pipeline',
  description: 'Seguimiento de tu funnel comercial',
}

interface PageProps {
  searchParams: Promise<{
    period?: string
    stage?: string
    type?: string
    refDate?: string
    tab?: string
  }>
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'daily',     label: 'Hoy'       },
  { value: 'weekly',    label: 'Semana'    },
  { value: 'monthly',   label: 'Mes'       },
  { value: 'quarterly', label: 'Trimestre' },
]

const TAB_OPTIONS = [
  { value: 'kanban',    label: 'Kanban'             },
  { value: 'funnel',    label: 'Funnel vs Recetario' },
  { value: 'registros', label: 'Registros'           },
]

function buildUrl(base: Record<string, string | undefined>) {
  const params = new URLSearchParams()
  for (const [k, v] of Object.entries(base)) {
    if (v) params.set(k, v)
  }
  const str = params.toString()
  return '/pipeline' + (str ? '?' + str : '')
}

export default async function PipelinePage({ searchParams }: PageProps) {
  const params         = await searchParams
  const period         = (['daily', 'weekly', 'monthly', 'quarterly'].includes(params.period ?? '')
    ? params.period
    : 'monthly') as PeriodType
  const tabParam       = (['kanban', 'funnel', 'registros'].includes(params.tab ?? '')
    ? params.tab
    : 'kanban') as 'kanban' | 'funnel' | 'registros'
  const stageFilter    = params.stage ?? ''
  const typeFilter     = (['OUTBOUND', 'INBOUND'].includes(params.type ?? '') ? params.type : '') as 'OUTBOUND' | 'INBOUND' | ''
  const refDateParam   = params.refDate ?? ''

  const today = todayISO()
  const [ty, tm, td] = today.split('-').map(Number)

  let anchorDate: Date
  if (/^\d{4}-\d{2}-\d{2}$/.test(refDateParam)) {
    const [ry, rm, rd] = refDateParam.split('-').map(Number)
    anchorDate = new Date(Date.UTC(ry, rm - 1, rd, 12, 0, 0))
  } else {
    anchorDate = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0))
  }

  const { start, end } = getPeriodRange(period, anchorDate)

  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()

  const [
    { data: scenario },
    { data: allEntries },
    { data: actLogs },
    { data: activeDealsRaw },
    { data: closedDealsRaw },
  ] = await Promise.all([
    sb.from('recipe_scenarios').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('pipeline_entries').select('*').gte('entry_date', start).lte('entry_date', end).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('vw_daily_compliance').select('type,real_executed').eq('user_id', user?.id ?? '').gte('log_date', start).lte('log_date', end),
    sb.from('deals').select('*').eq('user_id', user?.id ?? '').eq('status', 'active').order('entry_date', { ascending: false }),
    sb.from('deals').select('*').eq('user_id', user?.id ?? '').in('status', ['won', 'lost']).order('closed_at', { ascending: false }),
  ])

  const activeDeals = (activeDealsRaw ?? []) as Deal[]
  const closedDeals = (closedDealsRaw ?? []) as Deal[]

  const stages        = scenario?.funnel_stages  ?? DEFAULT_FUNNEL_STAGES
  const outboundRates = scenario?.outbound_rates ?? DEFAULT_OUTBOUND_RATES
  const inboundRates  = scenario?.inbound_rates  ?? DEFAULT_INBOUND_RATES
  const workingDays   = scenario?.working_days_per_month ?? 20

  // Activity totals split by type
  const activityOutbound = (actLogs ?? []).filter(l => l.type === 'OUTBOUND').reduce((s, l) => s + l.real_executed, 0)
  const activityInbound  = (actLogs ?? []).filter(l => l.type === 'INBOUND').reduce((s, l) => s + l.real_executed, 0)
  const activityTotal    = activityOutbound + activityInbound

  // Entries filtered by type for funnel + table when a type filter is active
  const filteredEntries = typeFilter
    ? (allEntries ?? []).filter(e => e.prospect_type === typeFilter)
    : (allEntries ?? [])

  // Further filter by stage for the table display
  const tableEntries = stageFilter
    ? filteredEntries.filter(e => e.stage === stageFilter)
    : filteredEntries

  // Combined planned rates (outbound + inbound weighted by outbound_pct)
  const outboundPct   = (scenario?.outbound_pct ?? 80) / 100
  const combinedRates = outboundRates.map((r, i) =>
    Math.round(r * outboundPct + (inboundRates[i] ?? r) * (1 - outboundPct))
  )

  // Activity total for conversions respects type filter
  const filteredActivityTotal = typeFilter === 'OUTBOUND' ? activityOutbound
    : typeFilter === 'INBOUND'  ? activityInbound
    : activityTotal

  const conversions   = calcRealConversions(filteredActivityTotal, filteredEntries, stages, combinedRates)
  const pipelineValue = calcPipelineValue(filteredEntries, stages)

  // Planned stage counts
  const recipeResult = scenario ? calcRecipe({
    monthly_revenue_goal:   scenario.monthly_revenue_goal,
    average_ticket:         scenario.average_ticket,
    outbound_pct:           scenario.outbound_pct,
    working_days_per_month: workingDays,
    funnel_stages: stages, outbound_rates: outboundRates, inbound_rates: inboundRates,
  }) : null

  // Per-type + combined counts by stage
  const countAll: Record<string, number>      = {}
  const countOutbound: Record<string, number> = {}
  const countInbound: Record<string, number>  = {}
  for (const e of allEntries ?? []) {
    countAll[e.stage]      = (countAll[e.stage] ?? 0) + e.quantity
    if (e.prospect_type === 'OUTBOUND') countOutbound[e.stage] = (countOutbound[e.stage] ?? 0) + e.quantity
    else                                countInbound[e.stage]  = (countInbound[e.stage] ?? 0)  + e.quantity
  }

  const stageStats = stages.map((stage, i) => {
    const realOutbound = i === 0 ? activityOutbound : (countOutbound[stage] ?? 0)
    const realInbound  = i === 0 ? activityInbound  : (countInbound[stage]  ?? 0)
    const realAll      = i === 0 ? activityTotal     : (countAll[stage]     ?? 0)
    const real = typeFilter === 'OUTBOUND' ? realOutbound
               : typeFilter === 'INBOUND'  ? realInbound
               : realAll
    const monthlyPlan = recipeResult
      ? Math.ceil((recipeResult.outbound.stage_values[i] ?? 0) + (recipeResult.inbound.stage_values[i] ?? 0))
      : 0
    return {
      stage,
      real,
      planned: scalePlanToperiod(monthlyPlan, period, workingDays),
      ...(!typeFilter ? { realOutbound, realInbound } : {}),
    }
  })

  const pLabel      = periodLabel(period, anchorDate)
  const monthlyGoal = scenario?.monthly_revenue_goal ?? 0
  const availableStages = stages.slice(1)

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Mi Pipeline" description="Seguimiento de tu funnel comercial" />
      <div className="flex-1 overflow-y-auto">

        {/* Tab navigation */}
        <div className="flex items-center border-b border-border bg-background px-8">
          {TAB_OPTIONS.map(({ value, label }) => (
            <Link
              key={value}
              href={buildUrl({
                tab:     value,
                period,
                type:    typeFilter || undefined,
                stage:   stageFilter || undefined,
                refDate: refDateParam || undefined,
              })}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                tabParam === value
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {label}
            </Link>
          ))}
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-3 flex-wrap border-b border-border bg-background px-8 py-3">
          {/* Period selector */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <Link key={value}
                href={buildUrl({ tab: tabParam, period: value, type: typeFilter || undefined, stage: stageFilter || undefined })}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                  period === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Date navigator — preserves all params including tab via useSearchParams */}
          <Suspense>
            <DateNavigator period={period} refDate={refDateParam || today} />
          </Suspense>

          {/* Type filter — hidden on kanban (no meaningful interaction there) */}
          {tabParam !== 'kanban' && (
            <div className="flex items-center rounded-md border border-border overflow-hidden">
              {[
                { value: '',         label: 'Todo'     },
                { value: 'OUTBOUND', label: 'Outbound' },
                { value: 'INBOUND',  label: 'Inbound'  },
              ].map(({ value, label }) => (
                <Link key={value}
                  href={buildUrl({ tab: tabParam, period, type: value || undefined, stage: stageFilter || undefined })}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                    typeFilter === value
                      ? value === 'OUTBOUND' ? 'bg-cyan-400/10 text-cyan-400'
                        : value === 'INBOUND' ? 'bg-purple-400/10 text-purple-400'
                        : 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          )}

          {/* Stage filter — only for funnel/registros */}
          {tabParam !== 'kanban' && availableStages.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <Link href={buildUrl({ tab: tabParam, period, type: typeFilter || undefined })}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  !stageFilter ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todas
              </Link>
              {availableStages.map((s) => (
                <Link key={s}
                  href={buildUrl({ tab: tabParam, period, type: typeFilter || undefined, stage: s })}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    stageFilter === s ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </Link>
              ))}
            </div>
          )}

          {/* New entry button — only for funnel/registros */}
          {tabParam !== 'kanban' && (
            <div className="ml-auto">
              <Suspense>
                <PipelineNewEntryModal stages={stages} scenarioId={scenario?.id ?? null} />
              </Suspense>
            </div>
          )}
        </div>

        {/* ── Kanban tab ─────────────────────────────────────────────────── */}
        {tabParam === 'kanban' && (
          <div className="p-6">
            <KanbanBoard
              activeDeals={activeDeals}
              closedDeals={closedDeals}
              stages={stages}
              scenarioId={scenario?.id ?? null}
              period={period}
            />
          </div>
        )}

        {/* ── Funnel tab ─────────────────────────────────────────────────── */}
        {tabParam === 'funnel' && (
          <div className="p-8 space-y-8 max-w-4xl">
            {!scenario && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
                Configura un recetario activo en{' '}
                <Link href="/recipe" className="underline underline-offset-2">Recetario</Link>
                {' '}para ver el análisis completo del pipeline.
              </div>
            )}
            <PipelineFunnelSummary
              stages={stages}
              stageStats={stageStats}
              conversions={conversions}
              openAmount={pipelineValue.open}
              closedAmount={pipelineValue.closed}
              monthlyGoal={monthlyGoal}
              periodLabel={pLabel}
              typeFilter={typeFilter || null}
            />
          </div>
        )}

        {/* ── Registros tab ──────────────────────────────────────────────── */}
        {tabParam === 'registros' && (
          <div className="p-8 space-y-8 max-w-4xl">
            {!scenario && (
              <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
                Configura un recetario activo en{' '}
                <Link href="/recipe" className="underline underline-offset-2">Recetario</Link>
                {' '}para ver el análisis completo del pipeline.
              </div>
            )}
            <div>
              <h2 className="text-sm font-semibold text-foreground mb-3">
                Registros
                {(stageFilter || typeFilter) && (
                  <span className="ml-2 text-xs font-normal text-muted-foreground">
                    {[typeFilter, stageFilter].filter(Boolean).join(' · ')}
                  </span>
                )}
              </h2>
              <PipelineEntriesTable
                entries={tableEntries}
                stages={stages}
                scenarioId={scenario?.id ?? null}
                stageFilter={stageFilter || undefined}
              />
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
