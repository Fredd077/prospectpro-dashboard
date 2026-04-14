'use client'

import { useState, useEffect, useCallback } from 'react'
import { Send, RefreshCw, CheckCircle2, AlertTriangle, Users, Clock, X } from 'lucide-react'
import { Calendar } from '@/components/ui/calendar'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { format, startOfWeek, endOfWeek, parseISO, formatDistanceToNow } from 'date-fns'
import { es } from 'date-fns/locale'

type PeriodType = 'daily' | 'weekly' | 'monthly' | 'quarterly'
type Scope      = 'team' | 'at_risk'
type LoadState  = 'idle' | 'collecting' | 'analyzing' | 'sending' | 'done' | 'error'

interface ReportRecord {
  id: string
  period_date: string
  report_scope: string | null
  triggered_by: string | null
  sent_to_email: string | null
  created_at: string
}

const STEPS: { state: LoadState; label: string }[] = [
  { state: 'collecting', label: 'Recopilando datos del equipo...' },
  { state: 'analyzing',  label: 'Analizando equipo con IA...'     },
  { state: 'sending',    label: 'Enviando al email...'            },
]

const MESES = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre',
]
const QUARTER_STARTS  = ['01-01','04-01','07-01','10-01']
const QUARTER_LABELS  = ['Q1 (Ene–Mar)','Q2 (Abr–Jun)','Q3 (Jul–Sep)','Q4 (Oct–Dic)']
const YEARS           = [2024, 2025, 2026, 2027]

function getPeriodDate(
  periodType: PeriodType,
  selectedDate: Date,
  selectedMonth: string,
  year: number,
  selectedQuarter: string,
): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  if (periodType === 'daily') {
    return `${selectedDate.getFullYear()}-${pad(selectedDate.getMonth()+1)}-${pad(selectedDate.getDate())}`
  }
  if (periodType === 'weekly') {
    const mon = startOfWeek(selectedDate, { weekStartsOn: 1 })
    return `${mon.getFullYear()}-${pad(mon.getMonth()+1)}-${pad(mon.getDate())}`
  }
  if (periodType === 'monthly') {
    const monthNum = MESES.indexOf(selectedMonth) + 1
    return `${year}-${pad(monthNum)}-01`
  }
  /* quarterly */
  const qIdx = QUARTER_LABELS.indexOf(selectedQuarter)
  return `${year}-${QUARTER_STARTS[qIdx >= 0 ? qIdx : 0]}`
}

export interface ReportModalProps {
  managerEmail:      string
  showCompanyFilter?: boolean
  companies?:        string[]
}

export function ReportModal({ managerEmail, showCompanyFilter, companies = [] }: ReportModalProps) {
  const [open, setOpen] = useState(false)

  // Form
  const [periodType,       setPeriodType]       = useState<PeriodType>('weekly')
  const [selectedDate,     setSelectedDate]     = useState<Date>(new Date())
  const [selectedMonth,    setSelectedMonth]    = useState(MESES[new Date().getMonth()])
  const [year,             setYear]             = useState(new Date().getFullYear())
  const [selectedQuarter,  setSelectedQuarter]  = useState(QUARTER_LABELS[Math.floor(new Date().getMonth() / 3)])
  const [scope,            setScope]            = useState<Scope>('team')
  const [selectedCompany,  setSelectedCompany]  = useState<string>('')

  // Loading
  const [loadState, setLoadState] = useState<LoadState>('idle')
  const [errorMsg,  setErrorMsg]  = useState<string | null>(null)
  const [sentTo,    setSentTo]    = useState<string | null>(null)

  // History
  const [reports, setReports] = useState<ReportRecord[]>([])

  const fetchHistory = useCallback(async () => {
    try {
      const res = await fetch('/api/reports/manual')
      if (res.ok) {
        const json = await res.json()
        setReports((json.reports ?? []).slice(0, 3))
      }
    } catch { /* silently ignore */ }
  }, [])

  useEffect(() => { fetchHistory() }, [fetchHistory])

  // Step ticker
  useEffect(() => {
    if (loadState === 'idle' || loadState === 'done' || loadState === 'error') return
    const idx = STEPS.findIndex(s => s.state === loadState)
    if (idx === -1) return
    const timer = setTimeout(() => {
      const next = STEPS[idx + 1]
      if (next) setLoadState(next.state)
    }, 3000)
    return () => clearTimeout(timer)
  }, [loadState])

  function handleClose() {
    setOpen(false)
    setTimeout(() => { setLoadState('idle'); setErrorMsg(null) }, 300)
  }

  async function handleGenerate() {
    const periodDate = getPeriodDate(periodType, selectedDate, selectedMonth, year, selectedQuarter)
    setLoadState('collecting')
    setErrorMsg(null)
    setSentTo(null)
    try {
      const res = await fetch('/api/reports/manual', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scope:       scope === 'at_risk' ? 'at_risk' : 'team',
          period_type: periodType,
          period_date: periodDate,
          ...(showCompanyFilter && selectedCompany ? { company: selectedCompany } : {}),
        }),
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

  const isLoading  = loadState !== 'idle' && loadState !== 'done' && loadState !== 'error'
  const weekFrom   = startOfWeek(selectedDate, { weekStartsOn: 1 })
  const weekTo     = endOfWeek(selectedDate,   { weekStartsOn: 1 })

  function pill(active: boolean): React.CSSProperties {
    return {
      fontSize: 12, fontWeight: 500, padding: '5px 14px', borderRadius: 6, cursor: 'pointer',
      background: active ? 'rgba(0,217,255,0.12)' : 'rgba(255,255,255,0.04)',
      color:      active ? '#00D9FF' : 'rgba(255,255,255,0.5)',
      border:     active ? '1px solid rgba(0,217,255,0.35)' : '1px solid transparent',
      transition: 'all 0.15s',
    }
  }

  return (
    <div className="space-y-3">

      {/* Trigger card */}
      <div style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', background: '#0d0d0d', padding: '16px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
        <div>
          <p style={{ fontSize: 14, fontWeight: 500, color: '#ffffff', margin: 0 }}>Generar reporte del equipo</p>
          <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '3px 0 0' }}>
            Se envía a <span style={{ color: 'rgba(255,255,255,0.65)' }}>{managerEmail}</span> · análisis IA
          </p>
        </div>
        <button
          onClick={() => setOpen(true)}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(0,217,255,0.4)', color: '#00D9FF', fontSize: 13, fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.15s' }}
          className="hover:bg-[rgba(0,217,255,0.08)]"
        >
          <Send style={{ width: 14, height: 14 }} />
          Generar reporte
        </button>
      </div>

      {/* History */}
      {reports.length > 0 && (
        <div style={{ borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)', background: '#0d0d0d', overflow: 'hidden' }}>
          <div style={{ padding: '8px 16px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <span style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.25)' }}>
              Últimos reportes
            </span>
          </div>
          {reports.map((r) => (
            <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '0.5px solid rgba(255,255,255,0.04)' }}>
              <Clock style={{ width: 12, height: 12, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {formatDistanceToNow(parseISO(r.created_at), { addSuffix: true, locale: es })}
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, borderRadius: 999, padding: '2px 8px', background: r.triggered_by === 'manual' ? 'rgba(0,217,255,0.1)' : 'rgba(255,255,255,0.06)', color: r.triggered_by === 'manual' ? '#00D9FF' : 'rgba(255,255,255,0.35)' }}>
                {r.triggered_by === 'manual' ? 'Manual' : 'Auto'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* ── Modal overlay ─────────────────────────────────────────────────── */}
      {open && (
        <>
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.78)', zIndex: 50, backdropFilter: 'blur(3px)' }}
            onClick={handleClose}
          />

          {/* Panel */}
          <div style={{
            position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            zIndex: 51, background: '#0a0a0a', borderRadius: 14,
            border: '1px solid rgba(0,217,255,0.2)',
            width: '100%', maxWidth: 500,
            maxHeight: '88vh', overflow: 'hidden',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 0 80px rgba(0,217,255,0.06)',
          }}>

            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
              <p style={{ fontSize: 15, fontWeight: 600, color: '#ffffff', margin: 0 }}>Configurar reporte</p>
              <button onClick={handleClose} style={{ background: 'transparent', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', padding: 4, borderRadius: 6, display: 'flex', alignItems: 'center' }} className="hover:text-white transition-colors">
                <X style={{ width: 16, height: 16 }} />
              </button>
            </div>

            {/* Scrollable body */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: 22 }}>

              {/* ── Idle: form ───────────────────────────────────────────── */}
              {loadState === 'idle' && (
                <>
                  {/* Empresa (solo admin) */}
                  {showCompanyFilter && companies.length > 0 && (
                    <div>
                      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                        Empresa
                      </p>
                      <Select value={selectedCompany} onValueChange={(v) => setSelectedCompany(v ?? '')}>
                        <SelectTrigger className="w-full bg-black border-cyan-500/30 text-white text-sm">
                          <SelectValue placeholder="Todas las empresas" />
                        </SelectTrigger>
                        <SelectContent className="bg-[#0a0a0a] border-cyan-500/30">
                          <SelectItem value="" className="text-white/50 focus:bg-cyan-500/10 focus:text-white">
                            Todas las empresas
                          </SelectItem>
                          {companies.map((c) => (
                            <SelectItem key={c} value={c} className="text-white focus:bg-cyan-500/10 focus:text-white">
                              {c}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Período */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                      Período
                    </p>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(['daily','weekly','monthly','quarterly'] as PeriodType[]).map((p) => {
                        const labels: Record<PeriodType, string> = { daily: 'Diario', weekly: 'Semanal', monthly: 'Mensual', quarterly: 'Trimestral' }
                        return (
                          <button key={p} onClick={() => setPeriodType(p)} style={pill(periodType === p)}>
                            {labels[p]}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Fecha */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                      Fecha
                    </p>

                    {(periodType === 'daily' || periodType === 'weekly') && (
                      <div>
                        <div style={{
                          '--background':           '#0a0a0a',
                          '--foreground':           '#ffffff',
                          '--primary':              '#00D9FF',
                          '--primary-foreground':   '#0a0a0a',
                          '--muted':                'rgba(0,217,255,0.08)',
                          '--muted-foreground':     'rgba(255,255,255,0.4)',
                          '--accent':               'rgba(0,217,255,0.1)',
                          '--accent-foreground':    '#ffffff',
                          '--ring':                 'rgba(0,217,255,0.4)',
                          '--popover':              '#0a0a0a',
                          '--popover-foreground':   '#ffffff',
                          borderRadius: 8,
                          border: '1px solid rgba(0,217,255,0.15)',
                          overflow: 'hidden',
                          width: 'fit-content',
                        } as React.CSSProperties}>
                          <Calendar
                            mode="single"
                            selected={selectedDate}
                            onSelect={(d) => d && setSelectedDate(d)}
                            locale={es}
                          />
                        </div>
                        {periodType === 'weekly' && (
                          <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', marginTop: 8 }}>
                            Semana:{' '}
                            <strong style={{ color: '#00D9FF' }}>
                              {format(weekFrom, 'd MMM', { locale: es })} – {format(weekTo, 'd MMM yyyy', { locale: es })}
                            </strong>
                          </p>
                        )}
                      </div>
                    )}

                    {periodType === 'monthly' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Select value={selectedMonth} onValueChange={(v) => setSelectedMonth(v ?? MESES[0])}>
                          <SelectTrigger className="flex-1 bg-black border-cyan-500/30 text-white text-sm">
                            <SelectValue placeholder="Mes" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-cyan-500/30">
                            {MESES.map((m) => (
                              <SelectItem key={m} value={m} className="text-white focus:bg-cyan-500/10 focus:text-white">
                                {m}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
                          <SelectTrigger className="flex-1 bg-black border-cyan-500/30 text-white text-sm">
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-cyan-500/30">
                            {YEARS.map((y) => (
                              <SelectItem key={y} value={String(y)} className="text-white focus:bg-cyan-500/10 focus:text-white">
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}

                    {periodType === 'quarterly' && (
                      <div style={{ display: 'flex', gap: 8 }}>
                        <Select value={selectedQuarter} onValueChange={(v) => setSelectedQuarter(v ?? QUARTER_LABELS[0])}>
                          <SelectTrigger className="flex-1 bg-black border-cyan-500/30 text-white text-sm">
                            <SelectValue placeholder="Trimestre" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-cyan-500/30">
                            {QUARTER_LABELS.map((q) => (
                              <SelectItem key={q} value={q} className="text-white focus:bg-cyan-500/10 focus:text-white">
                                {q}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Select value={String(year)} onValueChange={(v) => v && setYear(Number(v))}>
                          <SelectTrigger className="flex-1 bg-black border-cyan-500/30 text-white text-sm">
                            <SelectValue placeholder="Año" />
                          </SelectTrigger>
                          <SelectContent className="bg-[#0a0a0a] border-cyan-500/30">
                            {YEARS.map((y) => (
                              <SelectItem key={y} value={String(y)} className="text-white focus:bg-cyan-500/10 focus:text-white">
                                {y}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>

                  {/* Alcance */}
                  <div>
                    <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'rgba(255,255,255,0.35)', margin: '0 0 10px' }}>
                      Alcance
                    </p>
                    <div style={{ display: 'flex', gap: 6 }}>
                      {([
                        { value: 'team'    as Scope, label: 'Equipo completo', Icon: Users          },
                        { value: 'at_risk' as Scope, label: 'Solo en riesgo',  Icon: AlertTriangle  },
                      ]).map(({ value, label, Icon }) => (
                        <button key={value} onClick={() => setScope(value)} style={{ ...pill(scope === value), display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Icon style={{ width: 13, height: 13 }} />
                          {label}
                        </button>
                      ))}
                    </div>
                  </div>
                </>
              )}

              {/* ── Loading: step progress ──────────────────────────────── */}
              {isLoading && (
                <div style={{ padding: '8px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {STEPS.map((step, i) => {
                    const idx    = STEPS.findIndex(s => s.state === loadState)
                    const active = step.state === loadState
                    const done   = idx > i
                    return (
                      <div key={step.state} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div style={{
                          width: 8, height: 8, borderRadius: '50%', flexShrink: 0,
                          background: done ? '#1D9E75' : active ? '#00D9FF' : 'rgba(255,255,255,0.1)',
                          ...(active ? { boxShadow: '0 0 8px rgba(0,217,255,0.5)' } : {}),
                        }} />
                        <span style={{ fontSize: 13, color: done ? 'rgba(29,158,117,0.65)' : active ? '#00D9FF' : 'rgba(255,255,255,0.2)', textDecoration: done ? 'line-through' : 'none', flex: 1 }}>
                          {step.label}
                        </span>
                        {active && <RefreshCw style={{ width: 12, height: 12, color: '#00D9FF', flexShrink: 0 }} className="animate-spin" />}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* ── Done ────────────────────────────────────────────────── */}
              {loadState === 'done' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
                  <CheckCircle2 style={{ width: 22, height: 22, color: '#1D9E75', flexShrink: 0 }} />
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1D9E75', margin: 0 }}>Reporte enviado</p>
                    {sentTo && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', margin: '3px 0 0' }}>a {sentTo}</p>}
                  </div>
                </div>
              )}

              {/* ── Error ───────────────────────────────────────────────── */}
              {loadState === 'error' && (
                <div style={{ padding: '8px 0' }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#E24B4A', margin: '0 0 5px' }}>Error generando reporte</p>
                  {errorMsg && <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', margin: 0 }}>{errorMsg}</p>}
                </div>
              )}

            </div>

            {/* Footer */}
            <div style={{ padding: '14px 24px', borderTop: '1px solid rgba(255,255,255,0.07)', display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 10 }}>
              {loadState === 'idle' && (
                <>
                  <button onClick={handleClose} style={{ fontSize: 13, padding: '8px 16px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer', transition: 'all 0.15s' }} className="hover:border-white/25 hover:text-white/70">
                    Cancelar
                  </button>
                  <button onClick={handleGenerate} style={{ fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 7, cursor: 'pointer', background: '#00D9FF', color: '#0a0a0a', border: 'none', display: 'inline-flex', alignItems: 'center', gap: 7, transition: 'opacity 0.15s' }} className="hover:opacity-85">
                    <Send style={{ width: 13, height: 13 }} />
                    Enviar reporte →
                  </button>
                </>
              )}
              {(loadState === 'done' || loadState === 'error') && (
                <>
                  {loadState === 'error' && (
                    <button onClick={() => setLoadState('idle')} style={{ fontSize: 13, padding: '8px 16px', borderRadius: 7, background: 'transparent', border: '1px solid rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.45)', cursor: 'pointer' }}>
                      Reintentar
                    </button>
                  )}
                  <button onClick={handleClose} style={{ fontSize: 13, fontWeight: 600, padding: '8px 20px', borderRadius: 7, background: '#00D9FF', color: '#0a0a0a', border: 'none', cursor: 'pointer' }}>
                    Cerrar
                  </button>
                </>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
