'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { CheckinActivityRow } from './CheckinActivityRow'
import { CheckinSummary } from './CheckinSummary'
import { DateNavigator } from './DateNavigator'
import { bulkUpsertLogs } from '@/lib/queries/logs'
import { todayISO } from '@/lib/utils/dates'
import type { Activity, DailyCompliance, RecipeScenario } from '@/lib/types/database'

interface CheckinFormProps {
  date: string
  activities: Activity[]
  existingLogs: DailyCompliance[]
  weeklyLogs: Record<string, number>
  activeScenario?: RecipeScenario | null
}

export function CheckinForm({ date, activities, existingLogs, weeklyLogs, activeScenario }: CheckinFormProps) {
  const router = useRouter()
  const isRetroactive = date !== todayISO()

  // Build initial values from existing logs (today's saved data)
  const initialValues: Record<string, number> = {}
  for (const activity of activities) {
    const log = existingLogs.find((l) => l.activity_id === activity.id)
    initialValues[activity.id] = log?.real_executed ?? 0
  }

  const [values, setValues] = useState<Record<string, number>>(initialValues)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  const outbound = activities.filter((a) => a.type === 'OUTBOUND')
  const inbound = activities.filter((a) => a.type === 'INBOUND')

  // weeklyRealExcludingToday: rest of week without today's entry
  // weeklyLogs already includes today's saved value; subtract it to get Mon–yesterday
  const weeklyExcludingToday: Record<string, number> = {}
  for (const activity of activities) {
    weeklyExcludingToday[activity.id] = Math.max(
      0,
      (weeklyLogs[activity.id] ?? 0) - (initialValues[activity.id] ?? 0)
    )
  }

  // Reactive weekly totals: rest-of-week + current input
  const weeklyDisplayValues: Record<string, number> = {}
  for (const activity of activities) {
    weeklyDisplayValues[activity.id] = (weeklyExcludingToday[activity.id] ?? 0) + (values[activity.id] ?? 0)
  }

  function handleChange(activityId: string, value: number) {
    setValues((prev) => ({ ...prev, [activityId]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const payloads = activities.map((activity) => ({
        activity_id: activity.id,
        log_date: date,
        day_goal: activity.daily_goal,
        real_executed: values[activity.id] ?? 0,
        is_retroactive: isRetroactive,
      }))
      await bulkUpsertLogs(payloads)
      toast.success('Check-in guardado correctamente')
      setSubmitted(true)
      router.refresh()
    } catch (err) {
      toast.error('Error al guardar el check-in')
      console.error(err)
    } finally {
      setIsSubmitting(false)
    }
  }

  // Footer totals — only count daily activities for the daily total
  const dailyActivities = activities.filter((a) => a.daily_goal >= 1)
  const totalGoal = dailyActivities.reduce((s, a) => s + a.daily_goal, 0)
  const totalReal = dailyActivities.reduce((s, a) => s + (values[a.id] ?? 0), 0)
  const compliancePct = totalGoal > 0 ? Math.round((totalReal / totalGoal) * 100) : 0

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Date navigator */}
      <div className="flex items-center justify-between">
        <DateNavigator currentDate={date} />
        {isRetroactive && (
          <span className="rounded-md bg-amber-400/10 px-2 py-1 text-xs font-medium text-amber-400 border border-amber-400/20">
            Entrada retroactiva
          </span>
        )}
      </div>

      {/* Summary shown after save */}
      {submitted && (
        <CheckinSummary
          date={date}
          activities={activities}
          values={values}
          weeklyDisplayValues={weeklyDisplayValues}
          isRetroactive={isRetroactive}
          activeScenario={activeScenario}
        />
      )}

      {/* OUTBOUND section */}
      {outbound.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Outbound
            </h3>
            <Separator className="flex-1" />
          </div>
          <div className="space-y-2">
            {outbound.map((activity) => (
              <CheckinActivityRow
                key={activity.id}
                activity={activity}
                value={values[activity.id] ?? 0}
                weeklyRealExcludingToday={weeklyExcludingToday[activity.id] ?? 0}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      )}

      {/* INBOUND section */}
      {inbound.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h3 className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">
              Inbound
            </h3>
            <Separator className="flex-1" />
          </div>
          <div className="space-y-2">
            {inbound.map((activity) => (
              <CheckinActivityRow
                key={activity.id}
                activity={activity}
                value={values[activity.id] ?? 0}
                weeklyRealExcludingToday={weeklyExcludingToday[activity.id] ?? 0}
                onChange={handleChange}
              />
            ))}
          </div>
        </div>
      )}

      {activities.length === 0 && (
        <div className="rounded-lg border border-dashed border-border bg-card py-12 text-center">
          <p className="text-sm text-muted-foreground">
            No hay actividades activas. Crea actividades primero.
          </p>
        </div>
      )}

      {/* Submit */}
      {activities.length > 0 && (
        <div className="flex items-center gap-4 pt-2 border-t border-border">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Guardando...' : submitted ? 'Actualizar' : 'Guardar check-in'}
          </Button>
          {totalGoal > 0 && (
            <span className="text-xs text-muted-foreground">
              Diario: <span className="tabular-nums text-foreground">{totalReal}</span>{' '}
              /{' '}
              <span className="tabular-nums">{totalGoal}</span>
              <span
                className={
                  compliancePct >= 100
                    ? ' text-emerald-400'
                    : compliancePct >= 70
                    ? ' text-amber-400'
                    : ' text-red-400'
                }
              >
                {' '}({compliancePct}%)
              </span>
            </span>
          )}
        </div>
      )}
    </form>
  )
}
