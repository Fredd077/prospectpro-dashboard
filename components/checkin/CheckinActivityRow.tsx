import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type { Activity } from '@/lib/types/database'

const CHANNEL_LABELS: Record<string, string> = {
  cold_call: 'Llamada fría',
  cold_message: 'Mensaje frío',
  linkedin_dm: 'DM LinkedIn',
  linkedin_post: 'Post LinkedIn',
  linkedin_comment: 'Comentario LinkedIn',
  networking_event: 'Evento Networking',
  networking_lead: 'Lead Networking',
  referral: 'Referido',
  mkt_lead: 'Lead MKT',
  vsl_lead: 'Lead VSL',
  other: 'Otro',
}

interface CheckinActivityRowProps {
  activity: Activity
  value: number               // today's current input value
  weeklyRealExcludingToday: number // sum Mon–yesterday (saved)
  onChange: (activityId: string, value: number) => void
}

export function CheckinActivityRow({
  activity,
  value,
  weeklyRealExcludingToday,
  onChange,
}: CheckinActivityRowProps) {
  const isWeekly = activity.daily_goal < 1

  // Weekly total = rest of week + today's entry
  const weeklyTotal = weeklyRealExcludingToday + value

  // --- DAILY mode ---
  const dailyGoal = activity.daily_goal
  const dailyPct = dailyGoal > 0 ? Math.min((value / dailyGoal) * 100, 100) : 0
  const dailyBarColor =
    dailyGoal === 0
      ? 'bg-muted-foreground/40'
      : value >= dailyGoal
      ? 'bg-emerald-400'
      : value >= dailyGoal * 0.7
      ? 'bg-amber-400'
      : value > 0
      ? 'bg-red-400/60'
      : 'bg-muted'

  // --- WEEKLY mode ---
  const weeklyGoal = activity.weekly_goal
  const weeklyPct = weeklyGoal > 0 ? Math.min((weeklyTotal / weeklyGoal) * 100, 100) : 0
  const weeklyBarColor =
    weeklyGoal === 0
      ? 'bg-muted-foreground/40'
      : weeklyTotal >= weeklyGoal
      ? 'bg-emerald-400'
      : weeklyTotal >= weeklyGoal * 0.7
      ? 'bg-amber-400'
      : weeklyTotal > 0
      ? 'bg-red-400/60'
      : 'bg-muted'

  const inputColorClass = isWeekly
    ? weeklyGoal > 0 && weeklyTotal >= weeklyGoal
      ? 'border-emerald-400/40 text-emerald-400'
      : weeklyGoal > 0 && weeklyTotal > 0 && weeklyTotal >= weeklyGoal * 0.7
      ? 'border-amber-400/40 text-amber-400'
      : weeklyGoal > 0 && weeklyTotal > 0
      ? 'border-red-400/40 text-red-400'
      : ''
    : dailyGoal > 0 && value >= dailyGoal
    ? 'border-emerald-400/40 text-emerald-400'
    : dailyGoal > 0 && value > 0 && value >= dailyGoal * 0.7
    ? 'border-amber-400/40 text-amber-400'
    : dailyGoal > 0 && value > 0
    ? 'border-red-400/40 text-red-400'
    : ''

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      {/* Activity info + progress */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{activity.name}</span>
          {isWeekly && (
            <span className="shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-muted text-muted-foreground">
              SEMANAL
            </span>
          )}
          <span className="text-xs text-muted-foreground shrink-0">
            {CHANNEL_LABELS[activity.channel] ?? activity.channel}
          </span>
        </div>

        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div
            className={cn(
              'h-1.5 rounded-full transition-all duration-300',
              isWeekly ? weeklyBarColor : dailyBarColor
            )}
            style={{ width: `${isWeekly ? weeklyPct : dailyPct}%` }}
          />
        </div>

        {/* Sub-label */}
        <p className="mt-1 text-[11px] text-muted-foreground">
          {isWeekly ? (
            <>Esta semana: <span className="tabular-nums text-foreground font-medium">{weeklyTotal}</span> de <span className="tabular-nums">{weeklyGoal}</span></>
          ) : (
            <>Esta semana: <span className="tabular-nums text-foreground font-medium">{weeklyTotal}</span> de <span className="tabular-nums">{weeklyGoal}</span></>
          )}
        </p>
      </div>

      {/* Goal label */}
      <div className="text-right shrink-0">
        <span className="text-xs text-muted-foreground">
          {isWeekly ? 'Meta semana' : 'Meta hoy'}:{' '}
          <span className="font-medium text-foreground">
            {isWeekly ? weeklyGoal : dailyGoal}
          </span>
        </span>
      </div>

      {/* Input */}
      <div className="w-20 shrink-0">
        <Input
          type="number"
          min={0}
          value={value}
          onChange={(e) => {
            const n = parseInt(e.target.value, 10)
            onChange(activity.id, isNaN(n) ? 0 : Math.max(0, n))
          }}
          className={cn('text-center tabular-nums', inputColorClass)}
        />
      </div>
    </div>
  )
}
