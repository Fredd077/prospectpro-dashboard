'use client'

import { useState } from 'react'
import { CheckCircle, AlertTriangle, Info } from 'lucide-react'
import { calcRecipe, DEFAULT_FUNNEL_STAGES, DEFAULT_OUTBOUND_RATES, DEFAULT_INBOUND_RATES } from '@/lib/calculations/recipe'
import { cn } from '@/lib/utils'

interface ActivityDef {
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  sort_order: number
}

const DEFAULT_ACTIVITIES: ActivityDef[] = [
  { name: 'Llamadas en frío',      type: 'OUTBOUND', channel: 'Teléfono',   sort_order: 1 },
  { name: 'Mensajes LinkedIn',     type: 'OUTBOUND', channel: 'LinkedIn',   sort_order: 2 },
  { name: 'Emails de prospección', type: 'OUTBOUND', channel: 'Email',      sort_order: 3 },
  { name: 'Seguimientos',          type: 'OUTBOUND', channel: 'Múltiple',   sort_order: 4 },
  { name: 'Eventos de networking', type: 'OUTBOUND', channel: 'Presencial', sort_order: 5 },
  { name: 'Respuestas a inbound',  type: 'INBOUND',  channel: 'Múltiple',   sort_order: 6 },
  { name: 'Demos realizadas',      type: 'INBOUND',  channel: 'Video',      sort_order: 7 },
]

const OUTBOUND_ACTIVITIES = DEFAULT_ACTIVITIES.filter((a) => a.type === 'OUTBOUND') // 5 activities → 20% each
const INBOUND_ACTIVITIES  = DEFAULT_ACTIVITIES.filter((a) => a.type === 'INBOUND')  // 2 activities → 50% each

function equalWeight(count: number, index: number): number {
  // Last activity gets remainder to ensure exact 100.00 sum
  if (index < count - 1) return Math.round(100 / count * 100) / 100
  return Math.round((100 - Math.round(100 / count * 100) / 100 * (count - 1)) * 100) / 100
}

const INITIAL_WEIGHTS: Record<string, number> = Object.fromEntries([
  ...OUTBOUND_ACTIVITIES.map((a, i) => [a.name, equalWeight(OUTBOUND_ACTIVITIES.length, i)]),
  ...INBOUND_ACTIVITIES.map((a, i)  => [a.name, equalWeight(INBOUND_ACTIVITIES.length, i)]),
])

interface RecipeData {
  monthly_revenue_goal: number
  average_ticket: number
  outbound_pct: number
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
}

export interface OnboardingActivityData {
  name: string
  type: 'OUTBOUND' | 'INBOUND'
  channel: string
  sort_order: number
  weight: number
  monthly_goal: number
  weekly_goal: number
  daily_goal: number
}

interface StepActivitiesProps {
  onSave: (activities: OnboardingActivityData[]) => void
  saving: boolean
  recipeData?: RecipeData | null
}

function calcGoals(weight: number, typeTotal: number, workingDays = 20) {
  const monthly = Math.ceil(typeTotal * weight / 100)
  const weekly  = Math.ceil(monthly / 4)
  const daily   = Math.ceil(monthly / workingDays)
  return { monthly, weekly, daily }
}

export function StepActivities({ onSave, saving, recipeData }: StepActivitiesProps) {
  const [weights, setWeights] = useState<Record<string, number>>(INITIAL_WEIGHTS)

  const recipe = recipeData
    ? calcRecipe({
        monthly_revenue_goal:   recipeData.monthly_revenue_goal,
        average_ticket:         recipeData.average_ticket,
        outbound_pct:           recipeData.outbound_pct,
        working_days_per_month: 20,
        funnel_stages:  recipeData.funnel_stages  ?? DEFAULT_FUNNEL_STAGES,
        outbound_rates: recipeData.outbound_rates ?? DEFAULT_OUTBOUND_RATES,
        inbound_rates:  recipeData.inbound_rates  ?? DEFAULT_INBOUND_RATES,
      })
    : null

  const outboundTotal = recipe?.outbound.activities_monthly ?? 0
  const inboundTotal  = recipe?.inbound.activities_monthly  ?? 0

  const outboundSum = OUTBOUND_ACTIVITIES.reduce((s, a) => s + (weights[a.name] ?? 0), 0)
  const inboundSum  = INBOUND_ACTIVITIES.reduce((s, a)  => s + (weights[a.name] ?? 0), 0)
  const outboundOk  = Math.abs(outboundSum - 100) < 0.05
  const inboundOk   = Math.abs(inboundSum  - 100) < 0.05
  const canSave     = outboundOk && inboundOk

  function setWeight(name: string, val: number) {
    setWeights((prev) => ({ ...prev, [name]: Math.max(0, Math.min(100, Math.round(val * 100) / 100)) }))
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSave) return

    const activities: OnboardingActivityData[] = DEFAULT_ACTIVITIES.map((act) => {
      const w = weights[act.name] ?? 0
      const typeTotal = act.type === 'OUTBOUND' ? outboundTotal : inboundTotal
      const { monthly, weekly, daily } = calcGoals(w, typeTotal)
      return {
        name:        act.name,
        type:        act.type,
        channel:     act.channel,
        sort_order:  act.sort_order,
        weight:      w,
        monthly_goal: monthly,
        weekly_goal:  weekly,
        daily_goal:   daily,
      }
    })
    onSave(activities)
  }

  const renderSection = (
    type: 'OUTBOUND' | 'INBOUND',
    list: ActivityDef[],
    typeTotal: number,
    weightSum: number,
    isValid: boolean,
  ) => {
    const accentColor = type === 'OUTBOUND' ? 'text-primary' : 'text-success'
    const barColor    = type === 'OUTBOUND' ? 'bg-primary'   : 'bg-success'
    const filledPct   = Math.min(weightSum, 100)
    const gap         = Math.round((100 - weightSum) * 10) / 10

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className={cn('text-xs font-bold uppercase tracking-widest', accentColor)}>
            {type} {recipe ? `— ${typeTotal} act/mes` : ''}
          </p>
          {isValid ? (
            <span className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
              <CheckCircle className="h-3 w-3" /> 100% ✅
            </span>
          ) : (
            <span className="text-[10px] text-amber-400 font-medium flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              {gap > 0 ? `Falta ${gap}%` : `Excedes ${Math.abs(gap)}%`}
            </span>
          )}
        </div>

        <div className="h-1 rounded-full bg-muted overflow-hidden">
          <div
            className={cn('h-full rounded-full transition-all duration-300',
              isValid ? 'bg-emerald-400' : weightSum > 100 ? 'bg-red-400' : barColor)}
            style={{ width: `${filledPct}%` }}
          />
        </div>

        <div className="space-y-1.5">
          {list.map((act) => {
            const w = weights[act.name] ?? 0
            const { monthly } = calcGoals(w, typeTotal)
            return (
              <div key={act.name} className="flex items-center gap-3 rounded-lg border border-border bg-muted/20 px-3 py-2">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{act.name}</p>
                  <p className="text-[10px] text-muted-foreground/60">{act.channel}</p>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <input
                    type="number"
                    value={w}
                    min={0}
                    max={100}
                    step={0.01}
                    onChange={(e) => setWeight(act.name, parseFloat(e.target.value) || 0)}
                    className="w-14 rounded border border-border bg-background px-2 py-1 text-center text-sm font-data text-foreground outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20"
                  />
                  <span className="text-[10px] text-muted-foreground">%</span>
                  {recipe && (
                    <span className="text-xs text-muted-foreground font-data w-16 text-right">
                      {monthly}<span className="text-muted-foreground/50">/mes</span>
                    </span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6">
      <div className="space-y-2">
        <h2 className="text-lg font-bold text-foreground">Distribución de Actividades</h2>
        <div className="flex items-start gap-2 rounded-md border border-primary/20 bg-primary/5 px-3 py-2.5">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
          <p className="text-sm text-foreground/90 leading-snug">
            Asigna un peso (%) a cada actividad. Las metas se calculan automáticamente desde tu Recetario.
            Puedes ajustarlos en cualquier momento desde <span className="font-medium text-primary">Actividades</span>.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {renderSection('OUTBOUND', OUTBOUND_ACTIVITIES, outboundTotal, outboundSum, outboundOk)}
        {renderSection('INBOUND',  INBOUND_ACTIVITIES,  inboundTotal,  inboundSum,  inboundOk)}

        <button
          type="submit"
          disabled={saving || !canSave}
          className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,217,255,0.25)] transition-all disabled:opacity-50"
        >
          {saving ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground/30 border-t-primary-foreground" />
          ) : (
            <CheckCircle className="h-4 w-4" />
          )}
          {saving ? 'Configurando...' : '¡Listo, ir al Dashboard! →'}
        </button>
        {!canSave && (
          <p className="text-xs text-center text-amber-400">
            Completa la distribución al 100% en ambos grupos para continuar
          </p>
        )}
      </form>
    </div>
  )
}
