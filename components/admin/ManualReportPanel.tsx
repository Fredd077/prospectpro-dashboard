'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { Send, RefreshCw, CheckCircle2, Users, AlertTriangle, Clock } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

interface UserProp {
  id: string
  full_name: string | null
  email: string
  company: string | null
}

export interface ManualReportPanelProps {
  adminEmail: string
  users: UserProp[]
}

interface ReportRecord {
  id: string
  period_date: string
  report_scope: string | null
  triggered_by: string | null
  sent_to_email: string | null
  created_at: string
}

type LoadState = 'idle' | 'collecting' | 'analyzing' | 'sending' | 'done' | 'error'

const STEPS: { state: LoadState; label: string }[] = [
  { state: 'collecting', label: 'Recopilando datos del equipo...' },
  { state: 'analyzing',  label: 'Analizando equipo con IA...' },
  { state: 'sending',    label: 'Enviando al email...' },
]

export function ManualReportPanel({ adminEmail, users }: ManualReportPanelProps) {
  const [filters, setFilters] = useState({
    scope:     'all' as 'all' | 'at_risk',
    company:   '' as string,
    userIds:   [] as string[],
    threshold: 70 as number,
  })
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)
  const [reports,   setReports]   = useState<ReportRecord[]>([])
  const [sentTo,    setSentTo]    = useState<string | null>(null)

  // Derived: unique companies in the user list
  const companies = useMemo(() => {
    const set = new Set(users.map((u) => u.company).filter(Boolean) as string[])
    return [...set].sort()
  }, [users])

  // Derived: users visible in checkbox list (filtered by selected company)
  const visibleUsers = useMemo(() => {
    if (!filters.company) return users
    return users.filter((u) => (u.company ?? '').toLowerCase() === filters.company.toLowerCase())
  }, [users, filters.company])

  const allChecked   = filters.userIds.length === 0
  const someChecked  = filters.userIds.length > 0 && filters.userIds.length < visibleUsers.length

  function toggleAllUsers() {
    setFilters((f) => ({ ...f, userIds: f.userIds.length === 0 ? [] : [] }))
  }

  function toggleUser(id: string) {
    setFilters((f) => {
      const next = f.userIds.includes(id)
        ? f.userIds.filter((x) => x !== id)
        : [...f.userIds, id]
      // If all visible users are now selected, reset to "all" (empty array)
      return { ...f, userIds: next.length === visibleUsers.length ? [] : next }
    })
  }

  // When company changes, reset userIds
  function handleCompanyChange(company: string) {
    setFilters((f) => ({ ...f, company, userIds: [] }))
  }

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/manual')
      if (res.ok) {
        const json = await res.json()
        setReports(json.reports ?? [])
      }
    } catch { /* silently ignore */ }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Step ticker — advances every 3 s while generating
  useEffect(() => {
    if (loadState === 'idle' || loadState === 'done' || loadState === 'error') return
    const idx = STEPS.findIndex((s) => s.state === loadState)
    if (idx === -1) return
    const timer = setTimeout(() => {
      const next = STEPS[idx + 1]
      if (next) setLoadState(next.state)
    }, 3000)
    return () => clearTimeout(timer)
  }, [loadState])

  async function handleGenerate() {
    setLoadState('collecting')
    setErrorMsg(null)
    setSentTo(null)
    try {
      const body = {
        scope:     filters.scope === 'at_risk' ? 'at_risk' : 'team',
        company:   filters.company || undefined,
        userIds:   filters.userIds.length > 0 ? filters.userIds : undefined,
        threshold: filters.threshold,
      }
      const res  = await fetch('/api/reports/manual', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(body),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido')
      setSentTo(json.sentTo)
      setLoadState('done')
      fetchHistory()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error generando reporte')
      setLoadState('error')
    }
  }

  async function handleResend(reportScope: string) {
    setLoadState('collecting')
    setErrorMsg(null)
    setSentTo(null)
    try {
      const res  = await fetch('/api/reports/manual', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ scope: reportScope }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? 'Error desconocido')
      setSentTo(json.sentTo)
      setLoadState('done')
      fetchHistory()
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Error reenviando')
      setLoadState('error')
    }
  }

  const isLoading = loadState !== 'idle' && loadState !== 'done' && loadState !== 'error'

  return (
    <div className="space-y-4">

      {/* ── Filter grid ─────────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-4 space-y-4">

        {/* SECCIÓN A — Alcance */}
        <div className="flex gap-2 flex-wrap">
          {([
            { value: 'all',     label: 'Equipo completo', Icon: Users },
            { value: 'at_risk', label: 'Solo en riesgo',  Icon: AlertTriangle },
          ] as { value: 'all' | 'at_risk'; label: string; Icon: React.ComponentType<{ className?: string }> }[]).map(({ value, label, Icon }) => (
            <button
              key={value}
              onClick={() => !isLoading && setFilters((f) => ({ ...f, scope: value }))}
              disabled={isLoading}
              className={[
                'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
                filters.scope === value
                  ? 'border-[#00D9FF]/60 bg-[#00D9FF]/10 text-[#00D9FF]'
                  : 'border-border bg-transparent text-muted-foreground hover:border-[#00D9FF]/30 hover:text-[#00D9FF]/70',
              ].join(' ')}
            >
              <Icon className="h-3 w-3" />
              {label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

          {/* SECCIÓN B — Empresa (solo si hay 2+ empresas) */}
          {companies.length >= 2 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
                Empresa
              </p>
              <select
                value={filters.company}
                onChange={(e) => handleCompanyChange(e.target.value)}
                disabled={isLoading}
                className="w-full text-xs rounded-md border border-border bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&>option]:bg-card [&>option]:text-foreground disabled:opacity-50"
              >
                <option value="">Todas las empresas</option>
                {companies.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          )}

          {/* SECCIÓN D — Umbral */}
          <div className="space-y-1.5">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Umbral de riesgo: <span className="text-[#00D9FF]">{filters.threshold}%</span>
            </p>
            <input
              type="range"
              min={0}
              max={100}
              value={filters.threshold}
              onChange={(e) => setFilters((f) => ({ ...f, threshold: Number(e.target.value) }))}
              disabled={isLoading}
              className="w-full accent-primary disabled:opacity-50"
            />
            <p className="text-[10px] text-muted-foreground/60">
              Solo incluir usuarios bajo este % cuando se usa &quot;Solo en riesgo&quot;
            </p>
          </div>

        </div>

        {/* SECCIÓN C — Representantes */}
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
            Representantes
          </p>
          <div className="max-h-[120px] overflow-y-auto rounded-md border border-border bg-background/40 p-2 space-y-0.5">
            {/* "Todos" master checkbox */}
            <label className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer py-0.5">
              <input
                type="checkbox"
                checked={allChecked}
                ref={(el) => { if (el) el.indeterminate = someChecked }}
                onChange={() => setFilters((f) => ({ ...f, userIds: [] }))}
                disabled={isLoading}
                className="accent-primary rounded"
              />
              <span className="font-semibold">Todos</span>
              <span className="text-[10px] text-muted-foreground/50">
                ({visibleUsers.length} reps)
              </span>
            </label>
            {visibleUsers.map((u) => (
              <label
                key={u.id}
                className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer py-0.5"
              >
                <input
                  type="checkbox"
                  checked={allChecked || filters.userIds.includes(u.id)}
                  onChange={() => {
                    // First click when "all" is selected: switch to individual mode
                    if (allChecked) {
                      setFilters((f) => ({ ...f, userIds: [u.id] }))
                    } else {
                      toggleUser(u.id)
                    }
                  }}
                  disabled={isLoading}
                  className="accent-primary rounded"
                />
                {u.full_name ?? u.email}
                {u.company && (
                  <span className="text-[10px] text-muted-foreground/50">{u.company}</span>
                )}
              </label>
            ))}
          </div>
        </div>

      </div>

      {/* ── Main action area ─────────────────────────────────────────────── */}
      <div className="rounded-lg border border-border bg-card p-5">
        {loadState === 'idle' && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Generar reporte ahora</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se envía a <span className="text-foreground/70">{adminEmail}</span> con análisis de IA y barras de progreso.
              </p>
            </div>
            <button
              onClick={handleGenerate}
              className="inline-flex items-center gap-2 rounded-md border border-[#00D9FF]/40 bg-[#0a0a0a] px-4 py-2 text-sm font-semibold text-[#00D9FF] hover:bg-[#00D9FF]/10 transition-colors whitespace-nowrap"
            >
              <Send className="h-3.5 w-3.5" />
              Generar reporte
            </button>
          </div>
        )}

        {isLoading && (
          <div className="space-y-3">
            {STEPS.map((step, i) => {
              const active = step.state === loadState
              const done   = STEPS.findIndex((s) => s.state === loadState) > i
              return (
                <div key={step.state} className="flex items-center gap-3">
                  <div className={[
                    'h-2 w-2 rounded-full flex-shrink-0 transition-colors',
                    done   ? 'bg-emerald-400'
                    : active ? 'bg-[#00D9FF] animate-pulse'
                    : 'bg-muted-foreground/20',
                  ].join(' ')} />
                  <span className={[
                    'text-xs transition-colors',
                    done   ? 'text-emerald-400/70 line-through'
                    : active ? 'text-[#00D9FF]'
                    : 'text-muted-foreground/30',
                  ].join(' ')}>
                    {step.label}
                  </span>
                  {active && (
                    <RefreshCw className="h-3 w-3 text-[#00D9FF] animate-spin ml-auto" />
                  )}
                </div>
              )
            })}
          </div>
        )}

        {loadState === 'done' && (
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-emerald-400">
              <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
              <div>
                <p className="text-sm font-semibold">Reporte enviado</p>
                {sentTo && (
                  <p className="text-xs text-muted-foreground mt-0.5">a {sentTo}</p>
                )}
              </div>
            </div>
            <button
              onClick={() => setLoadState('idle')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Generar otro
            </button>
          </div>
        )}

        {loadState === 'error' && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-semibold text-red-400">Error generando reporte</p>
              {errorMsg && (
                <p className="text-xs text-muted-foreground mt-0.5 font-mono">{errorMsg}</p>
              )}
            </div>
            <button
              onClick={() => setLoadState('idle')}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Reintentar
            </button>
          </div>
        )}
      </div>

      {/* ── History ──────────────────────────────────────────────────────── */}
      {reports.length > 0 && (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-2.5 border-b border-border">
            <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">
              Últimos reportes
            </span>
          </div>
          <div className="divide-y divide-border/40">
            {reports.map((r) => (
              <div key={r.id} className="flex items-center justify-between gap-3 px-4 py-2.5">
                <div className="flex items-center gap-2 min-w-0">
                  <Clock className="h-3 w-3 text-muted-foreground/40 flex-shrink-0" />
                  <span className="text-xs text-muted-foreground truncate">
                    {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true, locale: es })}
                  </span>
                  <span className={[
                    'rounded-full px-2 py-0.5 text-[10px] font-semibold flex-shrink-0',
                    r.triggered_by === 'manual'
                      ? 'bg-[#00D9FF]/10 text-[#00D9FF]'
                      : 'bg-muted/50 text-muted-foreground',
                  ].join(' ')}>
                    {r.triggered_by === 'manual' ? 'Manual' : 'Auto'}
                  </span>
                  <span className="rounded-full border border-border px-2 py-0.5 text-[10px] text-muted-foreground flex-shrink-0">
                    {r.report_scope === 'at_risk' ? 'En riesgo' : 'Completo'}
                  </span>
                </div>
                <button
                  onClick={() => !isLoading && handleResend(r.report_scope ?? 'team')}
                  disabled={isLoading}
                  className="text-[10px] text-muted-foreground hover:text-[#00D9FF] transition-colors flex-shrink-0 disabled:opacity-40"
                >
                  Reenviar
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
