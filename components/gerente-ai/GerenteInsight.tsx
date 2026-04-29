'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { BrainCircuit, RefreshCw, ChevronDown, ChevronUp, TrendingUp, GitBranch, Zap, Play } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Props {
  startISO:       string
  endISO:         string
  selectedRepIds: string[]
  allReps:        { id: string; name: string; email: string }[]
}

interface Sections {
  situacion:     string
  pipeline:      string
  recomendacion: string
}

function parseSections(raw: string): Partial<Sections> {
  const result: Partial<Sections> = {}
  const sitMatch  = raw.match(/SITUACI[ÓO]N:\s*([^\n]+)/i)
  const pipMatch  = raw.match(/PIPELINE:\s*([^\n]+)/i)
  const recMatch  = raw.match(/RECOMENDACI[ÓO]N:\s*([^\n]+)/i)
  if (sitMatch?.[1]?.trim()) result.situacion     = sitMatch[1].trim()
  if (pipMatch?.[1]?.trim()) result.pipeline      = pipMatch[1].trim()
  if (recMatch?.[1]?.trim()) result.recomendacion = recMatch[1].trim()
  return result
}

const SECTION_META = [
  { key: 'situacion'    as const, label: 'Situación',     Icon: TrendingUp, color: 'text-cyan-400',   bg: 'bg-cyan-500/10',   border: 'border-cyan-500/20'   },
  { key: 'pipeline'     as const, label: 'Pipeline',      Icon: GitBranch,  color: 'text-violet-400', bg: 'bg-violet-500/10', border: 'border-violet-500/20' },
  { key: 'recomendacion'as const, label: 'Recomendación', Icon: Zap,        color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20'  },
]

export function GerenteInsight({ startISO, endISO, selectedRepIds, allReps }: Props) {
  const [rawText,    setRawText]    = useState('')
  const [loading,    setLoading]    = useState(false)
  const [collapsed,  setCollapsed]  = useState(false)
  const [dirty,      setDirty]      = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // When filters change: clear previous analysis and mark dirty
  useEffect(() => {
    setRawText('')
    setDirty(true)
  }, [startISO, endISO, selectedRepIds])

  const generate = useCallback(async () => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    const repNames = selectedRepIds.length > 0
      ? allReps.filter((r) => selectedRepIds.includes(r.id)).map((r) => r.name)
      : []

    setRawText('')
    setLoading(true)
    setDirty(false)
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
        setRawText((prev) => prev + decoder.decode(value, { stream: true }))
      }
    } catch (e: any) {
      if (e?.name !== 'AbortError') setRawText('SITUACIÓN: No se pudo generar el análisis. Intenta de nuevo.')
    } finally {
      setLoading(false)
    }
  }, [startISO, endISO, selectedRepIds, allReps])

  const sections = parseSections(rawText)
  const hasContent = Object.keys(sections).length > 0
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
          {hasContent && !loading && (
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
        <div className="px-4 py-3">

          {/* CTA when dirty (filters changed or never generated) */}
          {dirty && !loading && (
            <div className="flex items-center justify-between py-2">
              <p className="text-[11px] text-white/35 italic">
                {hasContent ? 'Los filtros cambiaron — el análisis anterior ya no aplica.' : 'Genera un análisis de IA sobre el período y alcance seleccionados.'}
              </p>
              <button
                onClick={generate}
                className="flex items-center gap-2 px-4 py-1.5 rounded-lg bg-violet-600/20 hover:bg-violet-600/35 border border-violet-500/30 hover:border-violet-400/50 text-violet-300 text-xs font-bold transition-all"
              >
                <Play className="h-3 w-3" />
                Generar análisis
              </button>
            </div>
          )}

          {/* Skeleton while first-load streaming */}
          {loading && !rawText && (
            <div className="space-y-3 py-1 animate-pulse">
              {SECTION_META.map((s) => (
                <div key={s.key} className="flex items-start gap-3">
                  <div className="mt-0.5 h-6 w-6 rounded bg-white/[0.06] shrink-0" />
                  <div className="flex-1 space-y-1.5">
                    <div className="h-2.5 bg-white/[0.06] rounded-full w-20" />
                    <div className="h-3 bg-white/[0.06] rounded-full w-full" />
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Structured sections */}
          {(hasContent || (loading && rawText)) && !dirty && (
            <div className="space-y-2 py-1">
              {SECTION_META.map(({ key, label, Icon, color, bg, border }) => {
                const text = sections[key]
                if (!text && !loading) return null
                return (
                  <div key={key} className={cn(
                    'flex items-start gap-3 rounded-lg px-3 py-2.5 border',
                    bg, border,
                  )}>
                    <div className={cn('mt-0.5 shrink-0 flex items-center justify-center h-6 w-6 rounded-md', bg, border)}>
                      <Icon className={cn('h-3.5 w-3.5', color)} />
                    </div>
                    <div className="min-w-0">
                      <p className={cn('text-[10px] font-bold uppercase tracking-[0.12em] mb-0.5', color)}>{label}</p>
                      {text ? (
                        <p className="text-[13px] text-white/80 leading-relaxed">
                          {text}
                          {loading && key === (Object.keys(sections).at(-1) as keyof Sections) && (
                            <span className="inline-block w-0.5 h-3.5 bg-violet-400 ml-0.5 animate-pulse align-middle" />
                          )}
                        </p>
                      ) : (
                        <div className="h-3 bg-white/[0.06] rounded-full w-4/5 animate-pulse mt-1" />
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}

        </div>
      )}
    </div>
  )
}
