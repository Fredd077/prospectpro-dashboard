'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

/**
 * Brief del copiloto — se carga de forma asíncrona desde /api/mi-dia para que el
 * resto de la página no espere a la IA. Muestra un esqueleto mientras llega.
 */
export function MiDiaBrief() {
  const [brief, setBrief] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    fetch('/api/mi-dia')
      .then((r) => r.json())
      .then((d: { brief?: string | null }) => {
        if (!active) return
        setBrief(d.brief ?? null)
        setLoading(false)
      })
      .catch(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  return (
    <div className="rounded-lg border border-border border-l-2 border-l-primary bg-card p-5 shadow-[0_0_30px_rgba(0,217,255,0.04)]">
      <div className="mb-2.5 flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-primary" />
        <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-primary">
          Brief del copiloto
        </span>
      </div>
      {loading ? (
        <div className="space-y-2 animate-pulse" aria-label="Cargando brief">
          <div className="h-3 w-full rounded bg-muted/60" />
          <div className="h-3 w-5/6 rounded bg-muted/60" />
          <div className="h-3 w-3/5 rounded bg-muted/60" />
        </div>
      ) : brief ? (
        <p className="text-sm leading-relaxed text-foreground/90">{brief}</p>
      ) : (
        <p className="text-sm text-muted-foreground">
          Configura tu recetario para recibir tu brief diario.
        </p>
      )}
    </div>
  )
}
