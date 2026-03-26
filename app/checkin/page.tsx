import type { Metadata } from 'next'
import { TopBar } from '@/components/layout/TopBar'
import { CheckinForm } from '@/components/checkin/CheckinForm'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { todayISO } from '@/lib/utils/dates'

export const metadata: Metadata = {
  title: 'Check-in Diario',
  description: 'Registra tus actividades de prospección del día',
}

export default async function CheckinPage() {
  const date = todayISO()
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
        title="Check-in Diario"
        description="Registra cuántas actividades completaste hoy"
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
