import Link from 'next/link'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils/dates'
import { fmtUSD } from '@/lib/calculations/pipeline'

export async function PipelineMiniCard() {
  const sb         = await getSupabaseServerClient()
  const today      = todayISO()
  const monthStart = today.slice(0, 8) + '01'

  const { data: rows } = await sb
    .from('pipeline_simple')
    .select('stage, amount_usd, status')
    .gte('entry_date', monthStart)
    .lte('entry_date', today)

  if (!rows?.length) return null

  const reuniones  = rows.filter(r => r.stage === 'Reunión').length
  const propuestas = rows.filter(r => r.stage === 'Propuesta').length
  const cierres    = rows.filter(r => r.stage === 'Cierre').length

  const enPropuesta = rows
    .filter(r => r.stage === 'Propuesta' && r.status === 'abierto')
    .reduce((s, r) => s + (r.amount_usd ?? 0), 0)

  const cerrado = rows
    .filter(r => r.stage === 'Cierre')
    .reduce((s, r) => s + (r.amount_usd ?? 0), 0)

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border/50">
        <span className="text-xs font-semibold text-foreground">Funnel Real — este mes</span>
        <Link href="/pipeline" className="text-[10px] text-primary hover:text-primary/80 transition-colors">
          Ver →
        </Link>
      </div>

      {/* Stage counts */}
      <div className="grid grid-cols-3 divide-x divide-border/50">
        <div className="px-4 py-3 text-center">
          <p className="text-xl font-bold tabular-nums text-cyan-400">{reuniones}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Reuniones</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xl font-bold tabular-nums text-amber-400">{propuestas}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Propuestas</p>
        </div>
        <div className="px-4 py-3 text-center">
          <p className="text-xl font-bold tabular-nums text-emerald-400">{cierres}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5">Cierres</p>
        </div>
      </div>

      {/* Revenue row */}
      <div className="px-4 py-2.5 border-t border-border/50 space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">En propuesta</span>
          <span className="font-semibold text-amber-400 tabular-nums">{fmtUSD(enPropuesta)}</span>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-muted-foreground">Cerrado 💰</span>
          <span className="font-semibold text-emerald-400 tabular-nums">{fmtUSD(cerrado)}</span>
        </div>
      </div>
    </div>
  )
}
