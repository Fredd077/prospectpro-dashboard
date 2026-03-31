'use client'

import { useState, useTransition } from 'react'
import { Check, Pencil, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateUserActivityGoal } from '@/lib/actions/team'

interface Activity {
  id: string
  name: string
  channel: string
  type: 'OUTBOUND' | 'INBOUND'
  monthly_goal: number
  weekly_goal: number
  daily_goal: number
  status: 'active' | 'inactive'
}

interface TeamUserGoalEditorProps {
  activities: Activity[]
  userId: string
}

function ActivityRow({ activity, userId }: { activity: Activity; userId: string }) {
  const [editing, setEditing]   = useState(false)
  const [value, setValue]       = useState(activity.monthly_goal.toString())
  const [current, setCurrent]   = useState(activity.monthly_goal)
  const [isPending, startTransition] = useTransition()

  function handleSave() {
    const parsed = parseInt(value, 10)
    if (isNaN(parsed) || parsed < 0) return
    startTransition(async () => {
      await updateUserActivityGoal(userId, activity.id, parsed)
      setCurrent(parsed)
      setEditing(false)
    })
  }

  function handleCancel() {
    setValue(current.toString())
    setEditing(false)
  }

  const weeklyCalc = Math.ceil(current / 4)
  const dailyCalc  = Math.ceil(current / 20)

  return (
    <tr className="border-b border-border/50 hover:bg-muted/20 transition-colors">
      <td className="px-4 py-3">
        <div>
          <p className="text-xs font-medium text-foreground">{activity.name}</p>
          <p className="text-[10px] text-muted-foreground">{activity.channel}</p>
        </div>
      </td>
      <td className="px-4 py-3">
        <span className={cn(
          'text-[10px] font-medium px-1.5 py-0.5 rounded border',
          activity.type === 'OUTBOUND'
            ? 'text-primary border-primary/20 bg-primary/5'
            : 'text-emerald-400 border-emerald-500/20 bg-emerald-500/5'
        )}>
          {activity.type}
        </span>
      </td>
      <td className="px-4 py-3">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              min={0}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); if (e.key === 'Escape') handleCancel() }}
              className="w-20 rounded border border-primary/40 bg-primary/5 px-2 py-1 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40"
              autoFocus
            />
            <button onClick={handleSave} disabled={isPending} className="text-emerald-400 hover:text-emerald-300 transition-colors">
              <Check className="h-3.5 w-3.5" />
            </button>
            <button onClick={handleCancel} disabled={isPending} className="text-muted-foreground hover:text-foreground transition-colors">
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 group">
            <span className="text-sm font-data font-semibold text-foreground">{current}</span>
            <button
              onClick={() => { setValue(current.toString()); setEditing(true) }}
              className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-all"
            >
              <Pencil className="h-3 w-3" />
            </button>
          </div>
        )}
      </td>
      <td className="px-4 py-3 text-xs font-data text-muted-foreground">{weeklyCalc}</td>
      <td className="px-4 py-3 text-xs font-data text-muted-foreground">{dailyCalc}</td>
    </tr>
  )
}

export function TeamUserGoalEditor({ activities, userId }: TeamUserGoalEditorProps) {
  const active   = activities.filter((a) => a.status === 'active')
  const inactive = activities.filter((a) => a.status === 'inactive')

  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-muted/30">
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Actividad</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Tipo</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Meta mensual</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Sem.</th>
              <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Día</th>
            </tr>
          </thead>
          <tbody>
            {active.map((a) => (
              <ActivityRow key={a.id} activity={a} userId={userId} />
            ))}
          </tbody>
        </table>
      </div>
      {inactive.length > 0 && (
        <details className="text-xs text-muted-foreground">
          <summary className="cursor-pointer hover:text-foreground transition-colors">
            {inactive.length} actividades inactivas
          </summary>
          <ul className="mt-2 space-y-1 pl-4">
            {inactive.map((a) => <li key={a.id} className="opacity-50">{a.name}</li>)}
          </ul>
        </details>
      )}
      <p className="text-[10px] text-muted-foreground">
        Haz clic en el lápiz (✏️) junto a la meta mensual para editarla. Sem. y Día se recalculan automáticamente.
      </p>
    </div>
  )
}
