'use client'

import { useState, useMemo, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO, startOfWeek, endOfWeek } from 'date-fns'
import { es } from 'date-fns/locale'
import { RefreshCw, Sparkles, Users, User } from 'lucide-react'
import { IntelligenceReportCard, type IntelligenceReportCardProps } from './IntelligenceReportCard'
import { cn } from '@/lib/utils'
import { todayISO, toISODate } from '@/lib/utils/dates'

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

function reanchorNoon(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 12, 0, 0))
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function buildPeriodOptions(filter: PeriodFilter): { value: string; label: string }[] {
  if (filter === 'all') return []

  const todayStr = todayISO()
  const [ty, tm, td] = todayStr.split('-').map(Number)
  const todayDate = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0))

  if (filter === 'monthly') {
    return Array.from({ length: 12 }, (_, i) => {
      let y = ty
      let m = tm - i
      while (m < 1) { m += 12; y-- }
      const periodStart = `${y}-${String(m).padStart(2, '0')}-01`
      const ref = new Date(Date.UTC(y, m - 1, 1, 12, 0, 0))
      return { value: periodStart, label: capitalize(format(ref, 'MMMM yyyy', { locale: es })) }
    })
  }

  if (filter === 'weekly') {
    const seen = new Set<string>()
    const options: { value: string; label: string }[] = []
    for (let i = 0; i < 12; i++) {
      const ref = new Date(todayDate.getTime() - i * 7 * 24 * 60 * 60 * 1000)
      const monday = reanchorNoon(startOfWeek(ref, { weekStartsOn: 1 }))
      const sunday = endOfWeek(ref, { weekStartsOn: 1 })
      const periodStart = toISODate(monday)
      if (seen.has(periodStart)) continue
      seen.add(periodStart)
      const label = `${format(monday, "d MMM", { locale: es })} – ${format(sunday, "d MMM yyyy", { locale: es })}`
      options.push({ value: periodStart, label })
    }
    return options
  }

  if (filter === 'daily') {
    return Array.from({ length: 60 }, (_, i) => {
      const ref = new Date(todayDate.getTime() - i * 24 * 60 * 60 * 1000)
      const periodStart = toISODate(ref)
      return { value: periodStart, label: capitalize(format(ref, "EEEE d 'de' MMMM yyyy", { locale: es })) }
    })
  }

  return []
}

export function IntelligenceHistoryClient({ vendedorReports, gerenteReports, isManager }: Props) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('personal')
  const [filter, setFilter] = useState<PeriodFilter>('all')
  const [selectedPeriodStart, setSelectedPeriodStart] = useState<string | null>(null)
  const [generating, startGenerating] = useTransition()
  const [error, setError] = useState<string | null>(null)

  const periodOptions = useMemo(() => buildPeriodOptions(filter), [filter])

  const activeReports = tab === 'equipo' ? gerenteReports : vendedorReports
  const filtered = filter === 'all'
    ? activeReports
    : activeReports.filter((r) => {
        if (r.period_type !== filter) return false
        if (selectedPeriodStart) return r.period_start === selectedPeriodStart
        return true
      })

  // Group by month of period_start
  const groups: { header: string; items: IntelligenceReportCardProps[] }[] = []
  for (const r of filtered) {
    const h = monthHeader(r.period_start)
    const last = groups[groups.length - 1]
    if (!last || last.header !== h) groups.push({ header: h, items: [r] })
    else last.items.push(r)
  }

  function handleFilterChange(newFilter: PeriodFilter) {
    setFilter(newFilter)
    setSelectedPeriodStart(null)
  }

  function handleGenerate() {
    setError(null)
    const endpoint = tab === 'equipo' ? '/api/intelligence/gerente' : '/api/intelligence/vendedor'
    const effectivePeriodType = filter === 'all' ? 'monthly' : filter
    const body: Record<string, string> = { periodType: effectivePeriodType }
    if (selectedPeriodStart) body.periodStart = selectedPeriodStart

    startGenerating(async () => {
      try {
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
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
              onClick={() => { setTab(value); setFilter('all'); setSelectedPeriodStart(null) }}
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
              onClick={() => handleFilterChange(t)}
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

      {/* Period selector */}
      {filter !== 'all' && periodOptions.length > 0 && (
        <select
          value={selectedPeriodStart ?? ''}
          onChange={(e) => setSelectedPeriodStart(e.target.value || null)}
          className="w-full rounded-lg border border-border bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-cyan-500/50"
        >
          <option value="">Período actual</option>
          {periodOptions.map((o) => (
            <option key={o.value} value={o.value}>{o.label}</option>
          ))}
        </select>
      )}

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
      {groups.map(({ header, items }, groupIdx) => (
        <div key={header} className="space-y-4">
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2">{header}</span>
            <div className="h-px flex-1 bg-border" />
          </div>
          {items.map((r, itemIdx) => (
            <div key={r.id} className="relative pl-6">
              <span className="absolute left-0 top-4 h-3 w-3 rounded-full border-2 border-background ring-1 ring-border bg-cyan-400" />
              <span className="absolute left-1.5 top-7 bottom-0 w-px bg-border" />
              <IntelligenceReportCard
                {...r}
                defaultExpanded={groupIdx === 0 && itemIdx === 0}
              />
            </div>
          ))}
        </div>
      ))}
    </div>
  )
}
