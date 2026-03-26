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
  value: number
  existingValue?: number
  onChange: (activityId: string, value: number) => void
}

export function CheckinActivityRow({
  activity,
  value,
  onChange,
}: CheckinActivityRowProps) {
  const goal = activity.daily_goal
  const pct = goal > 0 ? Math.min((value / goal) * 100, 100) : 0

  const barColor =
    goal === 0
      ? 'bg-muted-foreground/40'
      : value >= goal
      ? 'bg-emerald-400'
      : value >= goal * 0.7
      ? 'bg-amber-400'
      : value > 0
      ? 'bg-red-400/60'
      : 'bg-muted'

  return (
    <div className="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
      {/* Activity info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{activity.name}</span>
          <span className="text-xs text-muted-foreground shrink-0">
            {CHANNEL_LABELS[activity.channel] ?? activity.channel}
          </span>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-1.5 w-full rounded-full bg-muted">
          <div
            className={cn('h-1.5 rounded-full transition-all duration-300', barColor)}
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Goal label */}
      <div className="text-right shrink-0">
        <span className="text-xs text-muted-foreground">
          Meta: <span className="font-medium text-foreground">{goal}</span>
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
          className={cn(
            'text-center tabular-nums',
            goal > 0 && value >= goal && 'border-emerald-400/40 text-emerald-400',
            goal > 0 && value > 0 && value >= goal * 0.7 && value < goal && 'border-amber-400/40 text-amber-400',
            goal > 0 && value > 0 && value < goal * 0.7 && 'border-red-400/40 text-red-400'
          )}
        />
      </div>
    </div>
  )
}
