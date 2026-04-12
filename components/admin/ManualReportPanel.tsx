'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, RefreshCw, CheckCircle2, Users, AlertTriangle, Clock } from 'lucide-react'
import { formatDistanceToNow, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

type Scope = 'team' | 'at_risk'

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

export function ManualReportPanel() {
  const [scope, setScope] = useState<Scope>('team')
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [stepIdx, setStepIdx] = useState(0)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [reports, setReports] = useState<ReportRecord[]>([])
  const [sentTo, setSentTo] = useState<string | null>(null)

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/manual')
      if (res.ok) {
        const json = await res.json()
        setReports(json.reports ?? [])
      }
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Step ticker — advances while generating
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
    setStepIdx(0)
    setErrorMsg(null)
    setSentTo(null)

    try {
      const res = await fetch('/api/reports/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope }),
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

  async function handleResend(reportId: string, reportScope: string) {
    setLoadState('collecting')
    setErrorMsg(null)
    setSentTo(null)
    try {
      const res = await fetch('/api/reports/manual', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scope: reportScope as Scope }),
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
  const currentStep = STEPS.find((s) => s.state === loadState)

  return (
    <div className="space-y-4">

      {/* ── Scope pills */}
      <div className="flex gap-2 flex-wrap">
        {([
          { value: 'team',    label: 'Equipo completo', Icon: Users },
          { value: 'at_risk', label: 'Solo en riesgo',  Icon: AlertTriangle },
        ] as { value: Scope; label: string; Icon: React.ComponentType<{ className?: string }> }[]).map(({ value, label, Icon }) => (
          <button
            key={value}
            onClick={() => !isLoading && setScope(value)}
            disabled={isLoading}
            className={[
              'inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors',
              scope === value
                ? 'border-[#00D9FF]/60 bg-[#00D9FF]/10 text-[#00D9FF]'
                : 'border-border bg-transparent text-muted-foreground hover:border-[#00D9FF]/30 hover:text-[#00D9FF]/70',
            ].join(' ')}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Main action area */}
      <div className="rounded-lg border border-border bg-card p-5">
        {loadState === 'idle' && (
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-foreground">Generar reporte ahora</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                Se envía por email con análisis de IA y barras de progreso por rep.
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

      {/* ── History */}
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
                  onClick={() => !isLoading && handleResend(r.id, r.report_scope ?? 'team')}
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
