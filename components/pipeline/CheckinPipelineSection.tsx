'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ChevronDown, ChevronUp, TrendingUp } from 'lucide-react'
import { FunnelCheckin } from './FunnelCheckin'

interface CheckinPipelineSectionProps {
  stages: string[]
  scenarioId?: string | null
  date: string
}

export function CheckinPipelineSection({ stages, scenarioId, date }: CheckinPipelineSectionProps) {
  const [expanded, setExpanded] = useState(false)
  const [saved, setSaved] = useState(0)
  const router = useRouter()

  if (stages.length <= 1) return null

  function handleSaved() {
    setSaved((n) => n + 1)
    router.refresh()
  }

  return (
    <div className="rounded-lg border border-border bg-card/50">
      <button
        type="button"
        onClick={() => setExpanded((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 text-left"
      >
        <div className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium text-foreground">¿Avanzaste en tu pipeline hoy?</span>
          {saved > 0 && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
              {saved} guardado{saved > 1 ? 's' : ''}
            </span>
          )}
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        )}
      </button>

      {expanded && (
        <div className="border-t border-border/50 px-4 pb-4 pt-3 space-y-3">
          <FunnelCheckin
            stages={stages}
            scenarioId={scenarioId ?? null}
            defaultDate={date}
            allowDateEdit={false}
            onSaved={handleSaved}
          />
          <p className="text-[10px] text-muted-foreground/60 text-center">
            Esta sección es opcional — no afecta el guardado del check-in.
          </p>
        </div>
      )}
    </div>
  )
}
