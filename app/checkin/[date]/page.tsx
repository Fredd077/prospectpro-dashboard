import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { CheckinForm } from '@/components/checkin/CheckinForm'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { formatDisplayDate } from '@/lib/utils/dates'
import { parseISO } from 'date-fns'

interface Props {
  params: Promise<{ date: string }>
}

// Validate YYYY-MM-DD format
function isValidDate(d: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(d) && !isNaN(parseISO(d).getTime())
}

export default async function CheckinDatePage({ params }: Props) {
  const { date } = await params

  if (!isValidDate(date)) notFound()

  const sb = await getSupabaseServerClient()

  const [{ data: activities }, { data: logs }] = await Promise.all([
    sb
      .from('activities')
      .select('*')
      .eq('status', 'active')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    sb
      .from('vw_daily_compliance')
      .select('*')
      .eq('log_date', date),
  ])

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
          />
        </div>
      </div>
    </div>
  )
}
