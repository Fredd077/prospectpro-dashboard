'use client'

import { useEffect, useRef, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface WeeklyCoachMessageProps {
  isMonday: boolean
  weekLabel: string         // e.g. "28 abr – 2 may"
  monthlyPct: number        // % of monthly goal achieved so far
  cachedMessage?: string    // pre-fetched from DB (server pass-through)
  cachedId?: string
  isLastWeek?: boolean      // true when showing previous week's analysis
}

export function WeeklyCoachMessage({
  isMonday,
  weekLabel,
  monthlyPct,
  cachedMessage,
  cachedId,
  isLastWeek = false,
}: WeeklyCoachMessageProps) {
  const [message, setMessage]     = useState(cachedMessage ?? '')
  const [messageId, setMessageId] = useState<string | null>(cachedId ?? null)
  const [loading, setLoading]     = useState(!cachedMessage && isMonday)
  const [collapsed, setCollapsed] = useState(false)
  const hasFetched = useRef(false)
  const retryRef   = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Only auto-generate on Mondays when no cached message
    if (cachedMessage || !isMonday || hasFetched.current) return
    hasFetched.current = true
    fetchCoachMessage()
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current)
    }
  }, [cachedMessage, isMonday])

  async function fetchCoachMessage(isRetry = false) {
    if (!isRetry) setLoading(true)

    try {
      const res = await fetch('/api/ai-coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'weekly' }),
      })
      if (!res.ok || !res.body) throw new Error('fetch failed')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      setLoading(false)

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          try {
            const parsed = JSON.parse(line.slice(6).trim())
            if (parsed.text) setMessage((prev) => prev + parsed.text)
            if (parsed.id)   setMessageId(parsed.id)
            if (parsed.silent_error) setMessage('')
          } catch { /* skip */ }
        }
      }
    } catch {
      if (!isRetry) {
        retryRef.current = setTimeout(() => fetchCoachMessage(true), 3000)
      } else {
        setLoading(false)
        setMessage('')
      }
    }
  }

  // Don't render if nothing to show and won't generate
  if (!loading && !message) return null

  const label = isLastWeek ? 'Análisis del lunes pasado' : 'Resumen semanal'

  if (loading) {
    return (
      <div className="border-l-4 border-cyan-500/40 bg-primary/5 rounded-r-lg px-5 py-4 space-y-3 animate-pulse">
        <div className="flex items-center gap-2">
          <span className="text-sm">🤖</span>
          <span className="text-xs font-semibold text-cyan-400">Coach Pro</span>
          <span className="rounded-full bg-cyan-500/20 px-2 py-0.5 text-[10px] text-cyan-400">SEMANAL</span>
          {weekLabel && (
            <span className="flex items-center gap-1 text-[10px] text-cyan-400/80">
              <span>📅</span><span>{weekLabel}</span>
            </span>
          )}
        </div>
        <div className="space-y-2">
          <div className="h-3 bg-muted/60 rounded w-full" />
          <div className="h-3 bg-muted/60 rounded w-5/6" />
          <div className="h-3 bg-muted/60 rounded w-4/5" />
          <div className="h-3 bg-muted/60 rounded w-11/12" />
        </div>
        <p className="text-xs text-muted-foreground italic">Coach Pro está analizando tu semana...</p>
      </div>
    )
  }

  if (!message) return null

  return (
    <div className="border-l-4 border-cyan-500/50 bg-primary/5 rounded-r-lg px-5 py-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm">🤖</span>
          <span className="text-xs font-semibold text-cyan-400">Coach Pro</span>
          <span className="rounded-full bg-cyan-500/15 px-2 py-0.5 text-[10px] text-cyan-400 border border-cyan-500/20">
            SEMANAL
          </span>
          {weekLabel && (
            <span className="flex items-center gap-1 text-[10px] text-cyan-400/80">
              <span>📅</span><span>{weekLabel}</span>
            </span>
          )}
        </div>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>

      {/* Collapsable body */}
      {!collapsed && (
        <>
          {/* Message */}
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{message}</p>

          {/* Footer */}
          <div className="flex items-center justify-between pt-1 flex-wrap gap-2">
            <span className="text-[11px] text-muted-foreground">
              {isLastWeek ? 'Análisis de semana anterior' : 'Resumen semanal'}
            </span>
            <div className="flex items-center gap-2 min-w-[160px]">
              <span className="text-[11px] text-muted-foreground shrink-0">Meta mensual</span>
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    monthlyPct >= 100 ? 'bg-emerald-400' : monthlyPct >= 70 ? 'bg-amber-400' : 'bg-red-400'
                  }`}
                  style={{ width: `${Math.min(monthlyPct, 100)}%` }}
                />
              </div>
              <span className={`text-[11px] font-data font-semibold shrink-0 ${
                monthlyPct >= 100 ? 'text-emerald-400' : monthlyPct >= 70 ? 'text-amber-400' : 'text-red-400'
              }`}>
                {monthlyPct}%
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
