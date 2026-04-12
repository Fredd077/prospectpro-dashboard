'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { cn } from '@/lib/utils'

interface CoachMsg {
  id: string
  type: 'daily' | 'weekly' | 'monthly' | 'team_report'
  message: string
  context: Record<string, unknown> | null
  period_date: string
  user_comment: string | null
  is_read: boolean
  created_at: string
}

interface Props {
  messages: CoachMsg[]
  uniqueMonths: string[]
  typeFilter: string
  monthFilter: string | null
  unreadCount: number
}

const TYPE_CONFIG = {
  daily:   { label: 'DIARIO',   color: 'bg-blue-500/15 text-blue-400 border-blue-500/20',   dot: 'bg-blue-400' },
  weekly:  { label: 'SEMANAL',  color: 'bg-violet-500/15 text-violet-400 border-violet-500/20', dot: 'bg-violet-400' },
  monthly: { label: 'MENSUAL',  color: 'bg-amber-500/15 text-amber-400 border-amber-500/20', dot: 'bg-amber-400' },
}

function periodLabel(type: string, periodDate: string): string {
  try {
    const d = parseISO(periodDate)
    if (type === 'daily') {
      return format(d, "EEEE d 'de' MMMM 'de' yyyy", { locale: es })
    }
    if (type === 'weekly') {
      const end = new Date(d); end.setDate(d.getDate() + 6)
      return `Semana del ${format(d, 'd', { locale: es })} al ${format(end, 'd \'de\' MMMM yyyy', { locale: es })}`
    }
    if (type === 'monthly') {
      return format(d, "MMMM yyyy", { locale: es })
    }
  } catch { /* */ }
  return periodDate
}

function monthHeader(periodDate: string): string {
  try {
    return format(parseISO(periodDate), 'MMMM yyyy', { locale: es }).toUpperCase()
  } catch { return periodDate.slice(0, 7) }
}

function formatCreatedAt(iso: string): string {
  try {
    return format(parseISO(iso), "d MMM 'a las' HH:mm", { locale: es })
  } catch { return iso }
}

export function CoachHistoryClient({
  messages,
  uniqueMonths,
  typeFilter,
  monthFilter,
  unreadCount,
}: Props) {
  const router = useRouter()
  const hasMarked = useRef(false)

  // Mark all as read on first render
  useEffect(() => {
    if (hasMarked.current || unreadCount === 0) return
    hasMarked.current = true
    fetch('/api/ai-coach', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ markAllRead: true }),
    }).then(() => router.refresh()).catch(() => {/* silent */})
  }, [unreadCount, router])

  function setFilter(key: 'type' | 'month', value: string) {
    const params = new URLSearchParams()
    if (key === 'type') { if (value !== 'all') params.set('type', value); if (monthFilter) params.set('month', monthFilter) }
    if (key === 'month') { if (typeFilter !== 'all') params.set('type', typeFilter); if (value) params.set('month', value) }
    router.push(`/coach${params.size > 0 ? '?' + params.toString() : ''}`)
  }

  // Group messages by month header
  const groups: { header: string; items: CoachMsg[] }[] = []
  for (const msg of messages) {
    const h = monthHeader(msg.period_date)
    const last = groups[groups.length - 1]
    if (!last || last.header !== h) groups.push({ header: h, items: [msg] })
    else last.items.push(msg)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Filter bar */}
      <div className="flex items-center gap-3 flex-wrap">
        {/* Type filter */}
        <div className="flex items-center gap-1 rounded-lg bg-muted/40 border border-border p-1">
          {(['all', 'daily', 'weekly', 'monthly'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilter('type', t)}
              className={cn(
                'px-3 py-1 rounded-md text-xs font-semibold transition-all',
                typeFilter === t
                  ? 'bg-card text-foreground shadow-sm border border-border'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {t === 'all' ? 'Todos' : t === 'daily' ? 'Diarios' : t === 'weekly' ? 'Semanales' : 'Mensuales'}
            </button>
          ))}
        </div>

        {/* Month filter */}
        {uniqueMonths.length > 0 && (
          <select
            value={monthFilter ?? ''}
            onChange={(e) => setFilter('month', e.target.value)}
            className="rounded-md border border-border bg-card text-xs text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-ring"
          >
            <option value="">Todos los meses</option>
            {uniqueMonths.map((m) => (
              <option key={m} value={m}>
                {(() => { try { return format(parseISO(`${m}-01`), 'MMMM yyyy', { locale: es }) } catch { return m } })()}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Empty state */}
      {messages.length === 0 && (
        <div className="flex flex-col items-center justify-center h-72 gap-4 rounded-lg border border-dashed border-border bg-card">
          <span className="text-3xl">🤖</span>
          <div className="text-center space-y-1">
            <p className="text-sm font-semibold text-foreground">Aún no tienes reportes</p>
            <p className="text-xs text-muted-foreground">Tu primer análisis llegará hoy a las 6pm 🤖</p>
          </div>
        </div>
      )}

      {/* Timeline */}
      {groups.map(({ header, items }) => (
        <div key={header} className="space-y-4">
          {/* Month divider */}
          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 px-2">
              {header}
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* Cards */}
          {items.map((msg) => {
            const cfg = TYPE_CONFIG[msg.type as keyof typeof TYPE_CONFIG] ?? TYPE_CONFIG.daily
            const compliance = (msg.context as { overallCompliance?: number } | null)?.overallCompliance
            const pLabel = periodLabel(msg.type, msg.period_date)

            return (
              <div
                key={msg.id}
                className="relative pl-6"
              >
                {/* Timeline dot */}
                <span className={cn('absolute left-0 top-4 h-3 w-3 rounded-full border-2 border-background ring-1 ring-border', cfg.dot)} />
                {/* Vertical line */}
                <span className="absolute left-1.5 top-7 bottom-0 w-px bg-border" />

                <div className={cn(
                  'rounded-xl border bg-card p-4 space-y-3',
                  !msg.is_read && 'border-cyan-500/20'
                )}>
                  {/* Header row */}
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={cn('rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide', cfg.color)}>
                      {cfg.label}
                    </span>
                    <div className="flex items-center gap-1.5 text-xs text-cyan-400/80">
                      <span>📅</span>
                      <span className="capitalize">{pLabel}</span>
                    </div>
                    {compliance !== undefined && (
                      <span className={cn(
                        'ml-auto text-xs font-data font-semibold',
                        compliance >= 80 ? 'text-emerald-400' : compliance >= 50 ? 'text-amber-400' : 'text-red-400'
                      )}>
                        {compliance}% cumplimiento
                      </span>
                    )}
                  </div>

                  {/* Message */}
                  <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{msg.message}</p>

                  {/* User comment */}
                  {msg.user_comment && (
                    <div className="rounded-md bg-muted/30 border border-border/50 px-3 py-2">
                      <p className="text-[10px] text-muted-foreground uppercase tracking-wide mb-0.5">Tu comentario</p>
                      <p className="text-xs text-foreground">{msg.user_comment}</p>
                    </div>
                  )}

                  {/* Footer */}
                  <p className="text-[10px] text-muted-foreground/60">
                    Generado el {formatCreatedAt(msg.created_at)}
                  </p>
                </div>
              </div>
            )
          })}
        </div>
      ))}
    </div>
  )
}
