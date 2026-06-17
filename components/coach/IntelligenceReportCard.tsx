'use client'

import { useState } from 'react'
import { format, parseISO, differenceInDays } from 'date-fns'
import { es } from 'date-fns/locale'
import {
  AlertTriangle, TrendingUp, TrendingDown, Minus, Users, User,
  ChevronDown, ChevronRight, Target, Activity, Radar,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { todayISO } from '@/lib/utils/dates'

interface CitasBlock { requeridas: number; reales: number; proyectadas: number; alcanza: boolean }
interface ChannelChip { canal: string; conversion: number; cierre: number }
interface ChannelsBlock { fortalezas: ChannelChip[]; debilidades: ChannelChip[] }

interface VendedorContent {
  resumen_ejecutivo?: string
  analisis_canales?: string
  senales_pipeline?: string[]
  diagnostico_narrativo?: string
  prediccion_narrativa?: string
  acciones_prioritarias?: { accion: string; impacto: string; plazo: string }[]
  cumplimiento_resumen?: string
  alerta?: string | null
  mensaje_motivacional?: string
  efectividad_canales?: string | null // compat con reportes antiguos
  citas?: CitasBlock
  canales?: ChannelsBlock
}

interface GerenteContent {
  resumen_ejecutivo?: string
  diagnostico_equipo?: string
  analisis_canales?: string
  senales_pipeline?: string[]
  ranking_rendimiento?: { posicion: number; nombre: string; compliance: number; estado: string }[]
  alertas_individuales?: { nombre: string; alerta: string; accion: string }[]
  prediccion_narrativa?: string
  acciones_gestion?: { accion: string; prioridad: string; deadline: string }[]
  mensaje_gerente?: string
  citas?: CitasBlock
  canales?: ChannelsBlock
}

export interface IntelligenceReportCardProps {
  id: string
  report_audience: 'vendedor' | 'gerente'
  period_type: 'daily' | 'weekly' | 'monthly'
  period_start: string
  period_end: string
  report_content: unknown
  confidence_level: string | null
  periods_analyzed: number | null
  created_at: string
  defaultExpanded?: boolean
}

const PERIOD_CONFIG = {
  daily:   { label: 'DIARIO',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',     dot: 'bg-blue-400' },
  weekly:  { label: 'SEMANAL',  color: 'bg-violet-500/15 text-violet-400 border-violet-500/20', dot: 'bg-violet-400' },
  monthly: { label: 'MENSUAL',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',   dot: 'bg-amber-400' },
}

const IMPACT_COLOR: Record<string, string> = {
  alto: 'text-red-400', alta: 'text-red-400',
  medio: 'text-amber-400', media: 'text-amber-400',
  bajo: 'text-emerald-400', baja: 'text-emerald-400',
}

function periodLabel(type: string, start: string, end: string): string {
  try {
    const d = parseISO(start)
    if (type === 'daily') return format(d, "EEEE d 'de' MMMM yyyy", { locale: es })
    if (type === 'weekly') {
      const e = parseISO(end)
      return `Semana del ${format(d, "d 'de' MMMM", { locale: es })} al ${format(e, "d 'de' MMMM yyyy", { locale: es })}`
    }
    return format(d, 'MMMM yyyy', { locale: es })
  } catch { return start }
}

/** Acota cualquier % a 0–100 para que no aparezcan cifras infladas (1200%, 800%). */
function capPct(n: number): number {
  return Math.min(100, Math.max(0, Math.round(n)))
}

function complianceColor(n: number) {
  return n >= 80 ? 'text-emerald-400' : n >= 50 ? 'text-amber-400' : 'text-red-400'
}

function estadoIcon(estado: string) {
  if (estado === 'destacado') return <TrendingUp className="h-3 w-3 text-emerald-400" />
  if (estado === 'en_riesgo') return <TrendingDown className="h-3 w-3 text-red-400" />
  return <Minus className="h-3 w-3 text-muted-foreground" />
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">{children}</p>
}

// ── Citas headline: lo primero que ve un CEO ───────────────────────────────────
function CitasHeadline({ citas }: { citas: CitasBlock }) {
  const brecha = Math.max(0, citas.requeridas - citas.proyectadas)
  return (
    <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/[0.04] p-4">
      <div className="flex items-center gap-2 mb-3">
        <Target className="h-4 w-4 text-cyan-400" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-cyan-400/80">Citas para la meta</span>
        <span className={cn(
          'ml-auto rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
          citas.alcanza
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
            : 'border-red-500/30 bg-red-500/10 text-red-400',
        )}>
          {citas.alcanza ? 'En camino a la meta' : 'Brecha de citas'}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="font-mono text-2xl font-bold tabular-nums text-cyan-400">{citas.proyectadas}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">Proyectadas</p>
        </div>
        <div>
          <p className="font-mono text-2xl font-bold tabular-nums text-foreground">{citas.requeridas}</p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">Requeridas</p>
        </div>
        <div>
          <p className={cn('font-mono text-2xl font-bold tabular-nums', brecha > 0 ? 'text-red-400' : 'text-emerald-400')}>
            {brecha > 0 ? `−${brecha}` : '✓'}
          </p>
          <p className="text-[10px] text-muted-foreground/70 mt-0.5">{brecha > 0 ? 'Faltan' : 'Cubiertas'}</p>
        </div>
      </div>
      <p className="text-[10px] text-muted-foreground/60 mt-2 text-center">
        {citas.reales} citas reales hasta hoy · proyección al cierre del mes
      </p>
    </div>
  )
}

// ── Canales: el protagonista ───────────────────────────────────────────────────
function ChipRow({ c, tone }: { c: ChannelChip; tone: 'good' | 'bad' }) {
  return (
    <div className={cn(
      'rounded-md border px-2.5 py-1.5',
      tone === 'good' ? 'border-emerald-500/25 bg-emerald-500/[0.06]' : 'border-red-500/25 bg-red-500/[0.06]',
    )}>
      <p className={cn('text-xs font-medium', tone === 'good' ? 'text-emerald-300' : 'text-red-300')}>{c.canal}</p>
      <p className="text-[10px] text-muted-foreground/70 font-mono tabular-nums">
        {capPct(c.conversion)}% a cita · {capPct(c.cierre)}% a cierre
      </p>
    </div>
  )
}

function ChannelChips({ canales }: { canales: ChannelsBlock }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3 w-3 text-emerald-400" />
          <SectionLabel>Fortalezas de canal</SectionLabel>
        </div>
        {canales.fortalezas.length > 0
          ? canales.fortalezas.map((c) => <ChipRow key={c.canal} c={c} tone="good" />)
          : <p className="text-[11px] text-muted-foreground/50">Sin datos suficientes</p>}
      </div>
      <div className="space-y-1.5">
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3 w-3 text-red-400" />
          <SectionLabel>Debilidades de canal</SectionLabel>
        </div>
        {canales.debilidades.length > 0
          ? canales.debilidades.map((c) => <ChipRow key={c.canal} c={c} tone="bad" />)
          : <p className="text-[11px] text-muted-foreground/50">Sin datos suficientes</p>}
      </div>
    </div>
  )
}

export function IntelligenceReportCard(props: IntelligenceReportCardProps) {
  const { report_audience, period_type, period_start, period_end, report_content, confidence_level, periods_analyzed, created_at, defaultExpanded = false } = props
  const [expanded, setExpanded] = useState(defaultExpanded)

  const cfg = PERIOD_CONFIG[period_type] ?? PERIOD_CONFIG.daily
  const pLabel = periodLabel(period_type, period_start, period_end)
  const isGerente = report_audience === 'gerente'
  const content = report_content as VendedorContent & GerenteContent

  const today = todayISO()
  const isClosed = today > period_end
  const totalDaysInPeriod = differenceInDays(parseISO(period_end), parseISO(period_start)) + 1
  const dayX = isClosed
    ? totalDaysInPeriod
    : Math.min(differenceInDays(parseISO(today), parseISO(period_start)) + 1, totalDaysInPeriod)

  const canalNarrativa = content.analisis_canales || content.efectividad_canales || null

  return (
    <div className={cn('rounded-xl border bg-card overflow-hidden', confidence_level === 'inicial' && 'border-amber-500/20')}>
      {/* Collapsible header */}
      <button
        type="button"
        onClick={() => setExpanded(v => !v)}
        className="w-full flex items-center gap-2 px-4 py-3 hover:bg-muted/20 transition-colors text-left"
      >
        <span className="shrink-0 text-muted-foreground/50">
          {expanded ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
        </span>
        <span className={cn('shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', cfg.color)}>
          {cfg.label}
        </span>
        {isGerente ? (
          <span className="shrink-0 flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-400">
            <Users className="h-2.5 w-2.5" />EQUIPO
          </span>
        ) : (
          <span className="shrink-0 flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <User className="h-2.5 w-2.5" />PERSONAL
          </span>
        )}
        <span className="text-xs text-cyan-400/80 capitalize min-w-0 truncate">{pLabel}</span>
        {isClosed ? (
          <span className="shrink-0 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-400">
            FINALIZADO
          </span>
        ) : (
          <span className="shrink-0 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-400">
            EN CURSO · {dayX}/{totalDaysInPeriod}
          </span>
        )}
        <span className="ml-auto shrink-0 flex items-center gap-2">
          {confidence_level === 'inicial' && (
            <span className="text-[10px] text-amber-400 font-medium">Período inicial</span>
          )}
          {isGerente && periods_analyzed != null && (
            <span className="text-[10px] text-muted-foreground">{periods_analyzed} miembros</span>
          )}
        </span>
      </button>

      {/* Preview line when collapsed */}
      {!expanded && content.resumen_ejecutivo && (
        <div className="px-4 pb-3 cursor-pointer" onClick={() => setExpanded(true)}>
          <p className="text-xs text-muted-foreground/60 line-clamp-1 pl-6">{content.resumen_ejecutivo}</p>
        </div>
      )}

      {/* Full content */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t border-border/50 pt-4">

          {/* Alert */}
          {content.alerta && (
            <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
              <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
              <p className="text-xs text-red-300">{content.alerta}</p>
            </div>
          )}

          {/* 1) Citas + meta (headline) */}
          {content.citas && <CitasHeadline citas={content.citas} />}
          {content.resumen_ejecutivo && (
            <p className="text-sm font-medium text-foreground leading-relaxed">{content.resumen_ejecutivo}</p>
          )}

          {/* 2) Análisis por canal (protagonista) */}
          {(content.canales || canalNarrativa) && (
            <div className="space-y-2.5 rounded-lg border border-cyan-500/15 bg-cyan-500/[0.02] p-3">
              <div className="flex items-center gap-1.5">
                <Radar className="h-3.5 w-3.5 text-cyan-400" />
                <SectionLabel>Análisis por canal</SectionLabel>
              </div>
              {content.canales && <ChannelChips canales={content.canales} />}
              {canalNarrativa && (
                <div className="space-y-1">
                  {canalNarrativa.split('\n').filter(Boolean).map((line, i) => (
                    <p key={i} className={cn('text-xs', line.toLowerCase().startsWith('recomendación') ? 'text-foreground font-medium' : 'text-muted-foreground leading-relaxed')}>
                      {line}
                    </p>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* 3) Señales de pipeline */}
          {content.senales_pipeline && content.senales_pipeline.length > 0 && (
            <div className="space-y-1.5">
              <div className="flex items-center gap-1.5">
                <Activity className="h-3.5 w-3.5 text-muted-foreground/60" />
                <SectionLabel>Señales de pipeline</SectionLabel>
              </div>
              <ul className="space-y-1">
                {content.senales_pipeline.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-xs text-muted-foreground">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-cyan-400/60" />
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Gerente: ranking + alertas individuales */}
          {isGerente && content.diagnostico_equipo && (
            <div className="space-y-1">
              <SectionLabel>Diagnóstico del equipo</SectionLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">{content.diagnostico_equipo}</p>
            </div>
          )}
          {isGerente && content.ranking_rendimiento && content.ranking_rendimiento.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Ranking</SectionLabel>
              <div className="space-y-1">
                {content.ranking_rendimiento.map((r) => (
                  <div key={r.posicion} className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground w-4 text-right">{r.posicion}.</span>
                    {estadoIcon(r.estado)}
                    <span className="text-xs text-foreground flex-1">{r.nombre}</span>
                    <span className={cn('text-xs font-semibold tabular-nums', complianceColor(capPct(r.compliance)))}>{capPct(r.compliance)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {isGerente && content.alertas_individuales && content.alertas_individuales.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Quién necesita atención</SectionLabel>
              {content.alertas_individuales.map((a, i) => (
                <div key={i} className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 space-y-0.5">
                  <p className="text-[10px] font-semibold text-red-400">{a.nombre}</p>
                  <p className="text-xs text-muted-foreground">{a.alerta}</p>
                  <p className="text-xs text-foreground">→ {a.accion}</p>
                </div>
              ))}
            </div>
          )}

          {/* Vendedor: diagnóstico + proyección (apoyo) */}
          {!isGerente && content.diagnostico_narrativo && (
            <div className="space-y-1">
              <SectionLabel>Diagnóstico</SectionLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">{content.diagnostico_narrativo}</p>
            </div>
          )}
          {content.prediccion_narrativa && (
            <div className="space-y-1">
              <SectionLabel>Proyección</SectionLabel>
              <p className="text-xs text-muted-foreground leading-relaxed">{content.prediccion_narrativa}</p>
            </div>
          )}

          {/* Acciones */}
          {!isGerente && content.acciones_prioritarias && content.acciones_prioritarias.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Acciones prioritarias</SectionLabel>
              {content.acciones_prioritarias.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn('text-[10px] font-bold mt-0.5 shrink-0 uppercase', IMPACT_COLOR[a.impacto] ?? 'text-muted-foreground')}>{a.impacto}</span>
                  <div>
                    <p className="text-xs text-foreground">{a.accion}</p>
                    <p className="text-[10px] text-muted-foreground">{a.plazo}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
          {isGerente && content.acciones_gestion && content.acciones_gestion.length > 0 && (
            <div className="space-y-2">
              <SectionLabel>Acciones de gestión</SectionLabel>
              {content.acciones_gestion.map((a, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={cn('text-[10px] font-bold mt-0.5 shrink-0 uppercase', IMPACT_COLOR[a.prioridad] ?? 'text-muted-foreground')}>{a.prioridad}</span>
                  <div>
                    <p className="text-xs text-foreground">{a.accion}</p>
                    <p className="text-[10px] text-muted-foreground">{a.deadline}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* 4) Cumplimiento de actividades (soporte, subordinado) */}
          {content.cumplimiento_resumen && (
            <div className="flex items-start gap-2 rounded-md border border-border bg-muted/20 px-3 py-2">
              <Activity className="h-3 w-3 text-muted-foreground/50 mt-0.5 shrink-0" />
              <div>
                <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">Cumplimiento (soporte) · </span>
                <span className="text-xs text-muted-foreground">{content.cumplimiento_resumen}</span>
              </div>
            </div>
          )}

          {/* Motivational */}
          {(content.mensaje_motivacional || content.mensaje_gerente) && (
            <p className="text-xs text-cyan-400/70 italic border-t border-border pt-3">
              {content.mensaje_motivacional ?? content.mensaje_gerente}
            </p>
          )}

          <p className="text-[10px] text-muted-foreground/50">
            Generado el {format(parseISO(created_at), "d MMM 'a las' HH:mm", { locale: es })}
          </p>
        </div>
      )}
    </div>
  )
}
