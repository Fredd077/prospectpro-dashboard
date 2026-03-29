'use client'

import { useState } from 'react'
import { CheckCircle, Info } from 'lucide-react'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'

interface ActivityDef {
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  monthly_goal: number
}

const DEFAULT_ACTIVITIES: ActivityDef[] = [
  { name: 'Llamadas en frío',      type: 'OUTBOUND', channel: 'Teléfono',   monthly_goal: 60  },
  { name: 'Mensajes LinkedIn',     type: 'OUTBOUND', channel: 'LinkedIn',   monthly_goal: 80  },
  { name: 'Emails de prospección', type: 'OUTBOUND', channel: 'Email',      monthly_goal: 80  },
  { name: 'Seguimientos',          type: 'OUTBOUND', channel: 'Múltiple',   monthly_goal: 40  },
  { name: 'Eventos de networking', type: 'OUTBOUND', channel: 'Presencial', monthly_goal: 4   },
  { name: 'Respuestas a inbound',  type: 'INBOUND',  channel: 'Múltiple',   monthly_goal: 20  },
  { name: 'Demos realizadas',      type: 'INBOUND',  channel: 'Video',      monthly_goal: 8   },
]

interface RecipeData {
  monthly_revenue_goal: number
  average_ticket: number
  outbound_pct: number
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
}

interface StepActivitiesProps {
  onSave: (overrides: { name: string; monthly_goal: number }[]) => void
  saving: boolean
  recipeData?: RecipeData | null
}

type StatusKey = 'alineado' | 'cerca' | 'por_debajo' | 'por_encima'

function getStatus(gapPct: number): StatusKey {
  if (gapPct > 20)  return 'por_encima'
  if (gapPct >= -10) return 'alineado'
  if (gapPct >= -25) return 'cerca'
  return 'por_debajo'
}

const STATUS_CONFIG: Record<StatusKey, { label: string; badgeCls: string; borderCls: string }> = {
  alineado:   { label: '🟢 Alineado',   badgeCls: 'bg-success/20 text-success',         borderCls: 'border-success/40'      },
  cerca:      { label: '🟡 Cerca',      badgeCls: 'bg-yellow-500/20 text-yellow-400',   borderCls: 'border-yellow-500/40'   },
  por_debajo: { label: '🔴 Por debajo', badgeCls: 'bg-destructive/20 text-destructive', borderCls: 'border-destructive/40'  },
  por_encima: { label: '🔵 Por encima', badgeCls: 'bg-blue-500/20 text-blue-400',       borderCls: 'border-blue-500/40'     },
}

export function StepActivities({ onSave, saving, recipeData }: StepActivitiesProps) {
  const [goals, setGoals] = useState<Record<string, number>>(
    Object.fromEntries(DEFAULT_ACTIVITIES.map((a) => [a.name, a.monthly_goal]))
  )

  function setGoal(name: string, val: number) {
    setGoals((prev) => ({ ...prev, [name]: Math.max(0, val) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const overrides = DEFAULT_ACTIVITIES.map((a) => ({
      name: a.name,
      monthly_goal: goals[a.name] ?? a.monthly_goal,
    }))
    onSave(overrides)
  }

  const outboundActivities = DEFAULT_ACTIVITIES.filter((a) => a.type === 'OUTBOUND')
  const inboundActivities  = DEFAULT_ACTIVITIES.filter((a) => a.type === 'INBOUND')

  // Live plan totals (recomputed on every goals change)
  const outboundPlan = outboundActivities.reduce((s, a) => s + (goals[a.name] ?? a.monthly_goal), 0)
  const inboundPlan  = inboundActivities.reduce((s, a)  => s + (goals[a.name] ?? a.monthly_goal), 0)
  const totalPlan    = outboundPlan + inboundPlan

  // Recipe targets from Step 2 data
  const recipe = recipeData
    ? calcRecipe({
        monthly_revenue_goal:   recipeData.monthly_revenue_goal,
        average_ticket:         recipeData.average_ticket,
        outbound_pct:           recipeData.outbound_pct,
        working_days_per_month: 22,
        funnel_stages:  recipeData.funnel_stages  ?? DEFAULT_FUNNEL_STAGES,
        outbound_rates: recipeData.outbound_rates ?? DEFAULT_OUTBOUND_RATES,
        inbound_rates:  recipeData.inbound_rates  ?? DEFAULT_INBOUND_RATES,
      })
    : null

  const outboundRecipe = recipe?.outbound.activities_monthly ?? 0
  const inboundRecipe  = recipe?.inbound.activities_monthly  ?? 0
  const totalRecipe    = outboundRecipe + inboundRecipe

  const calcGap    = (plan: number, rec: number) => plan - rec
  const calcGapPct = (plan: number, rec: number) => rec > 0 ? ((plan - rec) / rec) * 100 : 0

  const totalGap        = calcGap(totalPlan, totalRecipe)
  const totalGapPct     = calcGapPct(totalPlan, totalRecipe)
  const totalStatus     = getStatus(totalGapPct)
  const totalStatusCfg  = STATUS_CONFIG[totalStatus]

  const comparisonRows = [
    { label: 'Outbound', plan: outboundPlan, rec: outboundRecipe, bold: false },
    { label: 'Inbound',  plan: inboundPlan,  rec: inboundRecipe,  bold: false },
    { label: 'Total',    plan: totalPlan,    rec: totalRecipe,    bold: true  },
  ]

  const statusMessage = (() => {
    const goalFmt = recipeData ? `$${recipeData.monthly_revenue_goal.toLocaleString()}` : 'tu meta'
    if (totalStatus === 'por_debajo') {
      return `⚠️ Tu plan está por debajo de lo necesario para alcanzar ${goalFmt}. Necesitas ${Math.abs(totalGap)} actividades más.`
    }
    if (totalStatus === 'cerca') {
      return `📈 Casi llegas. Con ${Math.abs(totalGap)} actividades más estarías completamente alineado con tu meta.`
    }
    return `✅ ¡Excelente! Tu plan está alineado con tu Recetario. Estás listo para empezar.`
  })()

  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">Tus Actividades</h2>
        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground/90 leading-snug">
            Ajusta las metas según tu proceso comercial real. No te preocupes, puedes modificarlas
            en cualquier momento desde <span className="font-medium text-primary">Actividades</span>.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div className="space-y-5">
          {/* Outbound */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">Outbound</p>
            <div className="space-y-2">
              {outboundActivities.map((act) => (
                <div key={act.name} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{act.name}</p>
                    <p className="text-[10px] text-muted-foreground/60">{act.channel}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      value={goals[act.name] ?? act.monthly_goal}
                      min={0}
                      onChange={(e) => setGoal(act.name, Number(e.target.value))}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm font-data text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                    <span className="text-[10px] text-muted-foreground/60">/ mes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Inbound */}
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-widest text-success">Inbound</p>
            <div className="space-y-2">
              {inboundActivities.map((act) => (
                <div key={act.name} className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-foreground truncate">{act.name}</p>
                    <p className="text-[10px] text-muted-foreground/60">{act.channel}</p>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <input
                      type="number"
                      value={goals[act.name] ?? act.monthly_goal}
                      min={0}
                      onChange={(e) => setGoal(act.name, Number(e.target.value))}
                      className="w-16 rounded border border-border bg-background px-2 py-1 text-center text-sm font-data text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                    />
                    <span className="text-[10px] text-muted-foreground/60">/ mes</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Plan vs Recetario comparison card */}
        {recipe && (
          <div className={`rounded-lg border bg-muted/10 p-4 space-y-3 ${totalStatusCfg.borderCls}`}>
            <p className="text-sm font-semibold text-foreground">📊 Tu plan vs tu Recetario</p>

            <table className="w-full">
              <thead>
                <tr className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 text-left"> </th>
                  <th className="pb-2 text-right">Tu Plan</th>
                  <th className="pb-2 text-right">Recetario</th>
                  <th className="pb-2 text-right">Diferencia</th>
                  <th className="pb-2 text-right">Estado</th>
                </tr>
              </thead>
              <tbody>
                {comparisonRows.map(({ label, plan, rec, bold }) => {
                  const g   = calcGap(plan, rec)
                  const gp  = calcGapPct(plan, rec)
                  const st  = getStatus(gp)
                  const cfg = STATUS_CONFIG[st]
                  const gapStr = `${g >= 0 ? '+' : ''}${g} (${gp >= 0 ? '+' : ''}${Math.round(gp)}%)`
                  return (
                    <tr
                      key={label}
                      className={bold ? 'border-t border-border/40 text-sm font-bold' : 'text-xs'}
                    >
                      <td className="py-1 text-left text-foreground">{label}</td>
                      <td className="py-1 text-right font-data">{plan}</td>
                      <td className="py-1 text-right font-data">{rec}</td>
                      <td className={`py-1 text-right font-data ${g < 0 ? 'text-destructive' : 'text-success'}`}>
                        {gapStr}
                      </td>
                      <td className="py-1 text-right">
                        <span className={`inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-medium ${cfg.badgeCls}`}>
                          {cfg.label}
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>

            <p className="text-xs text-muted-foreground">{statusMessage}</p>
          </div>
        )}

        {/* Action button */}
        <div>
          <button
            type="submit"
            disabled={saving}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,217,255,0.25)] transition-all disabled:opacity-50"
          >
            {saving ? (
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
            ) : (
              <CheckCircle className="h-4 w-4" />
            )}
            {saving ? 'Configurando...' : '¡Listo, ir al Dashboard! →'}
          </button>
        </div>
      </form>
    </div>
  )
}
