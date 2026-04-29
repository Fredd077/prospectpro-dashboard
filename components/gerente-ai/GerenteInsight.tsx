'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrainCircuit, RefreshCw, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  startISO:       string
  endISO:         string
  selectedRepIds: string[]
  allReps:        { id: string; name: string; email: string }[]
}

export function GerenteInsight({ startISO, endISO, selectedRepIds, allReps }: Props) {
  const [text,       setText]       = useState('')
  const [loading,    setLoading]    = useState(false)
  const [collapsed,  setCollapsed]  = useState(false)
  const [generated,  setGenerated]  = useState(false)
  const abortRef = useRef<AbortController | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const generate = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    const repNames = selectedRepIds.length > 0
      ? allReps.filter((r) => selectedRepIds.includes(r.id)).map((r) => r.name)
      : []

    setText('')
    setLoading(true)
    setCollapsed(false)

    try {
      const res = await fetch('/api/gerente-ai/insight', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ userIds: selectedRepIds, repNames, startISO, endISO }),
        signal:  abortRef.current.signal,
      })

      if (!res.ok || !res.body) throw new Error('Stream error')

      const reader  = res.body.getReader()
      const decoder = new TextDecoder()

      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        setText((prev) => prev + decoder.decode(value, { stream: true }))
      }
      setGenerated(true)
    } catch (e: any) {
      if (e?.name !== 'AbortError') setText('No se pudo generar el análisis. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [startISO, endISO, selectedRepIds, allReps])

  // Auto-generate when period or rep selection changes (debounced)
  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(generate, 600)
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      abortRef.current?.abort()
    }
  }, [generate])

  const scopeLabel = selectedRepIds.length === 0
    ? 'Equipo completo'
    : selectedRepIds.length === 1
      ? allReps.find((r) => r.id === selectedRepIds[0])?.name.split(' ')[0] ?? '1 vendedor'
      : `${selectedRepIds.length} vendedores`

  return (
    <div className={cn(
      'mx-4 mb-3 rounded-xl border overflow-hidden transition-all duration-300',
      'border-violet-500/20 bg-gradient-to-br from-violet-950/30 via-[#0d1117] to-[#080b12]',
      'shadow-[0_0_24px_rgba(139,92,246,0.06)]'
    )}>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-white/[0.05]">
        <div className="flex items-center gap-2.5">
          <div className="flex items-center justify-center h-6 w-6 rounded-md bg-violet-500/15 border border-violet-500/25">
            <BrainCircuit className="h-3.5 w-3.5 text-violet-400" />
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-[0.1em] text-violet-300/80">
              Análisis IA
            </span>
            <span className="text-[10px] text-white/25 font-mono">·</span>
            <span className="text-[11px] text-white/40">{scopeLabel}</span>
          </div>
          {loading && (
            <span className="flex items-center gap-1 text-[10px] text-violet-400/60 ml-1">
              <span className="inline-block h-1 w-1 rounded-full bg-violet-400 animate-pulse" />
              <span className="inline-block h-1 w-1 rounded-full bg-violet-400 animate-pulse [animation-delay:150ms]" />
              <span className="inline-block h-1 w-1 rounded-full bg-violet-400 animate-pulse [animation-delay:300ms]" />
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {generated && !loading && (
            <button onClick={generate}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] font-bold text-white/30 hover:text-violet-300 hover:bg-violet-500/10 transition-all border border-transparent hover:border-violet-500/20">
              <RefreshCw className="h-3 w-3" />
              Regenerar
            </button>
          )}
          <button onClick={() => setCollapsed((v) => !v)}
            className="p-1 rounded text-white/25 hover:text-white/60 transition-colors">
            {collapsed ? <ChevronDown className="h-4 w-4" /> : <ChevronUp className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Body */}
      {!collapsed && (
        <div className="px-5 py-4 min-h-[60px]">
          {loading && !text && (
            <div className="space-y-2 animate-pulse">
              <div className="h-3.5 bg-white/[0.06] rounded-full w-full" />
              <div className="h-3.5 bg-white/[0.06] rounded-full w-5/6" />
              <div className="h-3.5 bg-white/[0.06] rounded-full w-4/6" />
            </div>
          )}
          {text && (
            <p className="text-sm text-white/75 leading-relaxed tracking-wide">
              {text}
              {loading && (
                <span className="inline-block w-0.5 h-4 bg-violet-400 ml-0.5 animate-pulse align-middle" />
              )}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
