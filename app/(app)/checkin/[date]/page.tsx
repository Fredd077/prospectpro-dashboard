import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { CheckinForm } from '@/components/checkin/CheckinForm'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { formatDisplayDate, toISODate } from '@/lib/utils/dates'
import { startOfWeek, endOfWeek, parseISO } from 'date-fns'

interface Props {
  params: Promise<{ date: string }>
}

function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(parseISO(d).getTime())
}

export default async function CheckinDatePage({ params }: Props) {
  const { date } = await params

  if (!isValidDate(date)) notFound()

  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  const userId = user?.id ?? ''

  // Week bounds (Mon–Sun) for the given date
  const dateObj = parseISO(date)
  const weekStart = toISODate(startOfWeek(dateObj, { weekStartsOn: 1 }))
  const weekEnd   = toISODate(endOfWeek(dateObj, { weekStartsOn: 1 }))

  const [{ data: activities }, { data: logs }, { data: weekLogs }, { data: activeScenario }] = await Promise.all([
    sb
      .from('activities')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    sb
      .from('vw_daily_compliance')
      .select('*')
      .eq('user_id', userId)
      .eq('log_date', date),
    sb
      .from('activity_logs')
      .select('activity_id,real_executed')
      .eq('user_id', userId)
      .gte('log_date', weekStart)
      .lte('log_date', weekEnd),
    sb
      .from('recipe_scenarios')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  // Build activityId → weekly sum map
  const weeklyLogs: Record<string, number> = {}
  for (const log of weekLogs ?? []) {
    weeklyLogs[log.activity_id] = (weeklyLogs[log.activity_id] ?? 0) + log.real_executed
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Check-in Retroactivo"
        description={formatDisplayDate(date)}
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          <CheckinForm
            date={date}
            activities={activities ?? []}
            existingLogs={logs ?? []}
            weeklyLogs={weeklyLogs}
            activeScenario={activeScenario}
          />
        </div>
      </div>
    </div>
  )
}
