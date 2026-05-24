'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { RefreshCw, Sparkles, Users, User } from 'lucide-react'
import { IntelligenceReportCard, type IntelligenceReportCardProps } from './IntelligenceReportCard'
import { cn } from '@/lib/utils'

type Tab = 'personal' | 'equipo'
type PeriodFilter = 'all' | 'daily' | 'weekly' | 'monthly'

interface Props {
  vendedorReports: IntelligenceReportCardProps[]
  gerenteReports: IntelligenceReportCardProps[]
  isManager: boolean
}

function monthHeader(periodDate: string): string {
  try { return format(parseISO(periodDate), 'MMMM yyyy', { locale: es }).toUpperCase() }
  catch { return periodDate.slice(0, 7) }
}

export function IntelligenceHistoryClient({ vendedorReports, gerenteReports, isManager }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('personal')
  const [filter, setFilter] = useState<PeriodFilter>('all')
  const [generating, startGenerating] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const activeReports = tab === 'equipo' ? gerenteReports : vendedorReports
  const filtered = filter === 'all' ? activeReports : activeReports.filter((r) => r.period_type === filter)

  // Group by month of period_start
  const groups: { header: string; items: IntelligenceReportCardProps[] }[] = []
  for (const r of filtered) {
    const h = monthHeader(r.period_start)
    const last = groups[groups.length - 1]
    if (!last || last.header !== h) groups.push({ header: h, items: [r] })
    else last.items.push(r)
  }

  function handleGenerate() {
    setError(null)
    const endpoint = tab === 'equipo' ? '/api/intelligence/gerente' : '/api/intelligence/vendedor'
    startGenerating(async () => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ periodType: 'monthly' }),
        })
        if (!res.ok) {
          const json = await res.json().catch(() => ({}))
          throw new Error((json as { error?: string }).error ?? 'Error generando reporte')
        }
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error desconocido')
      }
    })
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Tabs (managers only) */}
      {isManager && (
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 border border-border p-1 w-fit">
          {([
            { value: 'personal' as Tab, label: 'Mi Reporte', Icon: User },
            { value: 'equipo'   as Tab, label: 'Equipo',      Icon: Users },
          ]).map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => { setTab(value); setFilter('all') }}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all',
                tab === value
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>
      )}

      {/* Filter + Generate row */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 border border-border p-1">
          {(['all', 'daily', 'weekly', 'monthly'] as PeriodFilter[]).map((t) => (
            <button
              key={t}
              onClick={() => setFilter(t)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-semibold transition-all',
                filter === t
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'all' ? 'Todos' : t === 'daily' ? 'Diarios' : t === 'weekly' ? 'Semanales' : 'Mensuales'}
            </button>
          ))}
        </div>

        <button
          onClick={handleGenerate}
          disabled={generating}
          className="ml-auto flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-400 transition-all hover:bg-cyan-500/20 disabled:opacity-50"
        >
          {generating
            ? <RefreshCw className="h-3 w-3 animate-spin" />
            : <Sparkles className="h-3 w-3" />}
          {generating ? 'Generando…' : 'Generar reporte'}
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {filtered.length === 0 && (
        <div className="flex flex-col items-center justify-center h-64 gap-4 rounded-lg border border-dashed border-border bg-card">
          <Sparkles className="h-8 w-8 text-muted-foreground/40" />
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Aún no hay reportes</p>
            <p className="text-xs text-muted-foreground">
              {tab === 'equipo'
                ? 'Genera el primer reporte de equipo con el botón de arriba'
                : 'Tu primer reporte se generará automáticamente esta noche'}
            </p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {groups.map(({ header, items }) => (
        <div key={header} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2">{header}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {items.map((r) => (
            <div key={r.id} className="relative pl-6">
              <span className="absolute left-0 top-4 h-3 w-3 rounded-full border-2 border-background ring-1 ring-border bg-cyan-400" />
              <span className="absolute left-1.5 top-7 bottom-0 w-px bg-border" />
              <IntelligenceReportCard {...r} />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
