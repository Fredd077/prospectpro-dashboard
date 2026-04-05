import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { PipelineFunnelSummary } from '@/components/pipeline/PipelineFunnelSummary'
import { PipelineEntriesTable } from '@/components/pipeline/PipelineEntriesTable'
import { PipelineNewEntryModal } from '@/components/pipeline/PipelineNewEntryModal'
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

export const metadata: Metadata = {
  title: 'Mi Pipeline',
  description: 'Seguimiento de tu funnel comercial',
}

interface PageProps {
  searchParams: Promise<{ period?: string; stage?: string }>
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'daily',     label: 'Hoy'       },
  { value: 'weekly',    label: 'Semana'    },
  { value: 'monthly',   label: 'Mes'       },
  { value: 'quarterly', label: 'Trimestre' },
]

export default async function PipelinePage({ searchParams }: PageProps) {
  const params      = await searchParams
  const period      = (['daily', 'weekly', 'monthly', 'quarterly'].includes(params.period ?? '')
    ? params.period
    : 'monthly') as PeriodType
  const stageFilter = params.stage ?? ''

  const today = todayISO()
  const { start, end } = getPeriodRange(period, new Date())

  const sb = await getSupabaseServerClient()

  const [{ data: scenario }, { data: entries }, { data: actLogs }] = await Promise.all([
    sb.from('recipe_scenarios').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('pipeline_entries').select('*').gte('entry_date', start).lte('entry_date', end).order('entry_date', { ascending: false }).order('created_at', { ascending: false }),
    sb.from('activity_logs').select('real_executed').gte('log_date', start).lte('log_date', end),
  ])

  const stages        = scenario?.funnel_stages  ?? DEFAULT_FUNNEL_STAGES
  const outboundRates = scenario?.outbound_rates ?? DEFAULT_OUTBOUND_RATES
  const inboundRates  = scenario?.inbound_rates  ?? DEFAULT_INBOUND_RATES
  const workingDays   = scenario?.working_days_per_month ?? 20
  const activityTotal = (actLogs ?? []).reduce((s, l) => s + l.real_executed, 0)

  // Combined planned rates
  const outboundPct   = (scenario?.outbound_pct ?? 80) / 100
  const combinedRates = outboundRates.map((r, i) =>
    Math.round(r * outboundPct + (inboundRates[i] ?? r) * (1 - outboundPct))
  )

  const conversions    = calcRealConversions(activityTotal, entries ?? [], stages, combinedRates)
  const pipelineValue  = calcPipelineValue(entries ?? [], stages)

  // Planned stage counts scaled to period
  const recipeResult = scenario ? calcRecipe({
    monthly_revenue_goal:   scenario.monthly_revenue_goal,
    average_ticket:         scenario.average_ticket,
    outbound_pct:           scenario.outbound_pct,
    working_days_per_month: workingDays,
    funnel_stages:  stages,
    outbound_rates: outboundRates,
    inbound_rates:  inboundRates,
  }) : null

  const countByStage: Record<string, number> = {}
  for (const e of entries ?? []) {
    countByStage[e.stage] = (countByStage[e.stage] ?? 0) + e.quantity
  }

  const stageStats = stages.map((stage, i) => {
    const realCount    = i === 0 ? activityTotal : (countByStage[stage] ?? 0)
    const monthlyPlan  = recipeResult
      ? Math.ceil((recipeResult.outbound.stage_values[i] ?? 0) + (recipeResult.inbound.stage_values[i] ?? 0))
      : 0
    return {
      stage,
      real:    realCount,
      planned: scalePlanToperiod(monthlyPlan, period, workingDays),
    }
  })

  const pLabel = periodLabel(period, new Date())
  const monthlyGoal = scenario?.monthly_revenue_goal ?? 0

  // Stage filter options
  const availableStages = stages.slice(1)

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Mi Pipeline" description="Seguimiento de tu funnel comercial" />
      <div className="flex-1 overflow-y-auto">

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap border-b border-border bg-background px-8 py-3">
          {/* Period selector */}
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <Link
                key={value}
                href={`/pipeline?period=${value}${stageFilter ? `&stage=${encodeURIComponent(stageFilter)}` : ''}`}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                  period === value
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          {/* Stage filter */}
          {availableStages.length > 0 && (
            <div className="flex items-center gap-1">
              <Link
                href={`/pipeline?period=${period}`}
                className={`px-2.5 py-1 rounded text-xs transition-colors ${
                  !stageFilter ? 'bg-muted text-foreground' : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                Todas
              </Link>
              {availableStages.map((s) => (
                <Link
                  key={s}
                  href={`/pipeline?period=${period}&stage=${encodeURIComponent(s)}`}
                  className={`px-2.5 py-1 rounded text-xs transition-colors ${
                    stageFilter === s ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {s}
                </Link>
              ))}
            </div>
          )}

          <div className="ml-auto">
            <Suspense>
              <PipelineNewEntryModal stages={stages} scenarioId={scenario?.id ?? null} />
            </Suspense>
          </div>
        </div>

        <div className="p-8 space-y-8 max-w-4xl">
          {/* No active recipe warning */}
          {!scenario && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-3 text-sm text-amber-400">
              Configura un recetario activo en{' '}
              <Link href="/recipe" className="underline underline-offset-2">Recetario</Link>
              {' '}para ver el análisis completo del pipeline.
            </div>
          )}

          {/* Funnel summary */}
          <PipelineFunnelSummary
            stages={stages}
            stageStats={stageStats}
            conversions={conversions}
            openAmount={pipelineValue.open}
            closedAmount={pipelineValue.closed}
            monthlyGoal={monthlyGoal}
            periodLabel={pLabel}
          />

          {/* Entries table */}
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">
              Registros
              {stageFilter && (
                <span className="ml-2 text-xs font-normal text-muted-foreground">
                  filtrando por "{stageFilter}"
                </span>
              )}
            </h2>
            <PipelineEntriesTable
              entries={entries ?? []}
              stages={stages}
              scenarioId={scenario?.id ?? null}
              stageFilter={stageFilter || undefined}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
