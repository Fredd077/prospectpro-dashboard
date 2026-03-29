'use client'

import { useState } from 'react'
import { CheckCircle } from 'lucide-react'

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

interface StepActivitiesProps {
  onSave: (overrides: { name: string; monthly_goal: number }[]) => void
  saving: boolean
}

export function StepActivities({ onSave, saving }: StepActivitiesProps) {
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

  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6">
      <div className="space-y-1">
        <h2 className="text-lg font-bold text-foreground">Tus Actividades</h2>
        <p className="text-sm text-muted-foreground">
          Ajusta las metas mensuales según tu realidad. Puedes editarlas después.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
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
          {saving ? 'Configurando...' : '¡Listo, ir al Dashboard →'}
        </button>
      </form>
    </div>
  )
}
