import type { Metadata } from 'next'
import { Suspense } from 'react'
import Link from 'next/link'
import { TopBar } from '@/components/layout/TopBar'
import { DateNavigator } from '@/components/dashboard/DateNavigator'
import { PipelineSimpleBoard } from '@/components/pipeline/PipelineSimpleBoard'
import { PipelineAnalysis } from '@/components/pipeline/PipelineAnalysis'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getPeriodRange, todayISO, periodLabel } from '@/lib/utils/dates'
import type { PeriodType } from '@/lib/types/common'
import type { PipelineSimple } from '@/lib/types/database'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Mi Pipeline',
  description: 'Seguimiento de tu funnel comercial',
}

interface PageProps {
  searchParams: Promise<{
    period?: string
    refDate?: string
  }>
}

const PERIOD_OPTIONS: { value: PeriodType; label: string }[] = [
  { value: 'daily',     label: 'Hoy'       },
  { value: 'weekly',    label: 'Semana'    },
  { value: 'monthly',   label: 'Mes'       },
  { value: 'quarterly', label: 'Trimestre' },
  { value: 'yearly',    label: 'Año'       },
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
  const params = await searchParams
  const period = (['daily', 'weekly', 'monthly', 'quarterly', 'yearly'].includes(params.period ?? '')
    ? params.period
    : 'monthly') as PeriodType
  const refDateParam = params.refDate ?? ''

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
    { data: pipelineSimpleRaw },
  ] = await Promise.all([
    sb.from('recipe_scenarios').select('*').eq('is_active', true).order('created_at', { ascending: false }).limit(1).maybeSingle(),
    sb.from('pipeline_simple').select('*').eq('user_id', user?.id ?? '').gte('entry_date', start).lte('entry_date', end).order('entry_date', { ascending: false }),
  ])

  const pipelineSimple     = (pipelineSimpleRaw ?? []) as PipelineSimple[]
  const monthlyRevenueGoal = scenario?.monthly_revenue_goal ?? null
  const pLabel             = periodLabel(period, anchorDate)

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Mi Pipeline" description="Seguimiento de tu funnel comercial" />
      <div className="flex-1 overflow-y-auto">

        {/* Tab navigation */}
        <div className="flex items-center border-b border-border bg-background px-8">
          <Link
            href={buildUrl({ period, refDate: refDateParam || undefined })}
            className="px-4 py-3 text-sm font-medium border-b-2 border-primary text-primary"
          >
            Pipeline
          </Link>
        </div>

        {/* Controls bar */}
        <div className="flex items-center gap-3 flex-wrap border-b border-border bg-background px-8 py-3">
          <div className="flex items-center rounded-md border border-border overflow-hidden">
            {PERIOD_OPTIONS.map(({ value, label }) => (
              <Link key={value}
                href={buildUrl({ period: value, refDate: refDateParam || undefined })}
                className={`px-3 py-1.5 text-xs font-medium transition-colors border-r border-border last:border-r-0 ${
                  period === value ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:text-foreground hover:bg-muted/30'
                }`}
              >
                {label}
              </Link>
            ))}
          </div>

          <Suspense>
            <DateNavigator period={period} refDate={refDateParam || today} />
          </Suspense>
        </div>

        {/* ── Pipeline tab ───────────────────────────────────────────────── */}
        <div className="p-6">
          <PipelineSimpleBoard
            entries={pipelineSimple}
            period={period}
            activeScenario={scenario ? {
              funnel_stages:          scenario.funnel_stages,
              outbound_rates:         scenario.outbound_rates,
              inbound_rates:          scenario.inbound_rates,
              working_days_per_month: scenario.working_days_per_month,
            } : null}
          />
          <PipelineAnalysis
            entries={pipelineSimple}
            monthlyRevenueGoal={monthlyRevenueGoal}
            period={period}
            periodLabel={pLabel}
          />
        </div>

      </div>
    </div>
  )
}
