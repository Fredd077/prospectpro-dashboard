'use client'

import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { AlertTriangle, TrendingUp, TrendingDown, Minus, Users, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VendedorContent {
  resumen_ejecutivo?: string
  diagnostico_narrativo?: string
  prediccion_narrativa?: string
  acciones_prioritarias?: { accion: string; impacto: string; plazo: string }[]
  alerta?: string | null
  mensaje_motivacional?: string
}

interface GerenteContent {
  resumen_ejecutivo?: string
  diagnostico_equipo?: string
  ranking_rendimiento?: { posicion: number; nombre: string; compliance: number; estado: string }[]
  alertas_individuales?: { nombre: string; alerta: string; accion: string }[]
  prediccion_narrativa?: string
  acciones_gestion?: { accion: string; prioridad: string; deadline: string }[]
  mensaje_gerente?: string
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
}

const PERIOD_CONFIG = {
  daily:   { label: 'DIARIO',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',     dot: 'bg-blue-400' },
  weekly:  { label: 'SEMANAL',  color: 'bg-violet-500/15 text-violet-400 border-violet-500/20', dot: 'bg-violet-400' },
  monthly: { label: 'MENSUAL',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/20',   dot: 'bg-amber-400' },
}

const IMPACT_COLOR: Record<string, string> = {
  alto: 'text-red-400',
  alta: 'text-red-400',
  medio: 'text-amber-400',
  media: 'text-amber-400',
  bajo: 'text-emerald-400',
  baja: 'text-emerald-400',
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

function complianceColor(n: number) {
  return n >= 80 ? 'text-emerald-400' : n >= 50 ? 'text-amber-400' : 'text-red-400'
}

function estadoIcon(estado: string) {
  if (estado === 'destacado') return <TrendingUp className="h-3 w-3 text-emerald-400" />
  if (estado === 'en_riesgo') return <TrendingDown className="h-3 w-3 text-red-400" />
  return <Minus className="h-3 w-3 text-muted-foreground" />
}

export function IntelligenceReportCard(props: IntelligenceReportCardProps) {
  const { report_audience, period_type, period_start, period_end, report_content, confidence_level, periods_analyzed, created_at } = props
  const cfg = PERIOD_CONFIG[period_type] ?? PERIOD_CONFIG.daily
  const pLabel = periodLabel(period_type, period_start, period_end)
  const isGerente = report_audience === 'gerente'
  const content = report_content as VendedorContent & GerenteContent

  return (
    <div className={cn('rounded-xl border bg-card p-4 space-y-4', confidence_level === 'inicial' && 'border-amber-500/20')}>
      {/* Header */}
      <div className="flex items-start gap-2 flex-wrap">
        <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', cfg.color)}>
          {cfg.label}
        </span>
        {isGerente ? (
          <span className="flex items-center gap-1 rounded-full border border-violet-500/30 bg-violet-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-violet-400">
            <Users className="h-2.5 w-2.5" />
            EQUIPO
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
            <User className="h-2.5 w-2.5" />
            PERSONAL
          </span>
        )}
        <span className="text-xs text-cyan-400/80 capitalize">{pLabel}</span>
        {confidence_level === 'inicial' && (
          <span className="ml-auto text-[10px] text-amber-400 font-medium">Período inicial</span>
        )}
        {isGerente && periods_analyzed != null && (
          <span className="ml-auto text-[10px] text-muted-foreground">{periods_analyzed} miembros</span>
        )}
      </div>

      {/* Alert */}
      {content.alerta && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2">
          <AlertTriangle className="h-3.5 w-3.5 text-red-400 mt-0.5 shrink-0" />
          <p className="text-xs text-red-300">{content.alerta}</p>
        </div>
      )}

      {/* Executive summary */}
      {content.resumen_ejecutivo && (
        <p className="text-sm font-medium text-foreground leading-relaxed">{content.resumen_ejecutivo}</p>
      )}

      {/* Vendedor: diagnostico + prediccion */}
      {!isGerente && content.diagnostico_narrativo && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Diagnóstico</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{content.diagnostico_narrativo}</p>
        </div>
      )}
      {!isGerente && content.prediccion_narrativa && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Proyección</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{content.prediccion_narrativa}</p>
        </div>
      )}

      {/* Gerente: diagnostico equipo + ranking */}
      {isGerente && content.diagnostico_equipo && (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Diagnóstico del equipo</p>
          <p className="text-xs text-muted-foreground leading-relaxed">{content.diagnostico_equipo}</p>
        </div>
      )}
      {isGerente && content.ranking_rendimiento && content.ranking_rendimiento.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Ranking</p>
          <div className="space-y-1">
            {content.ranking_rendimiento.map((r) => (
              <div key={r.posicion} className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground w-4 text-right">{r.posicion}.</span>
                {estadoIcon(r.estado)}
                <span className="text-xs text-foreground flex-1">{r.nombre}</span>
                <span className={cn('text-xs font-semibold tabular-nums', complianceColor(r.compliance))}>{r.compliance}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {isGerente && content.alertas_individuales && content.alertas_individuales.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Alertas individuales</p>
          {content.alertas_individuales.map((a, i) => (
            <div key={i} className="rounded-md border border-red-500/20 bg-red-500/5 px-3 py-2 space-y-0.5">
              <p className="text-[10px] font-semibold text-red-400">{a.nombre}</p>
              <p className="text-xs text-muted-foreground">{a.alerta}</p>
              <p className="text-xs text-foreground">→ {a.accion}</p>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {!isGerente && content.acciones_prioritarias && content.acciones_prioritarias.length > 0 && (
        <div className="space-y-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Acciones prioritarias</p>
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
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/60">Acciones de gestión</p>
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

      {/* Motivational */}
      {(content.mensaje_motivacional || content.mensaje_gerente) && (
        <p className="text-xs text-cyan-400/70 italic border-t border-border pt-3">
          {content.mensaje_motivacional ?? content.mensaje_gerente}
        </p>
      )}

      {/* Footer */}
      <p className="text-[10px] text-muted-foreground/50">
        Generado el {format(parseISO(created_at), "d MMM 'a las' HH:mm", { locale: es })}
      </p>
    </div>
  )
}
