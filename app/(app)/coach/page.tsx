import type { Metadata } from 'next'
import { format, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { TopBar } from '@/components/layout/TopBar'
import { CoachHistoryClient } from '@/components/coach/CoachHistoryClient'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const metadata: Metadata = {
  title: 'Coach Pro — Historial',
  description: 'Todos tus reportes de prospección en un lugar',
}

interface PageProps {
  searchParams: Promise<{ type?: string; month?: string }>
}

export default async function CoachPage({ searchParams }: PageProps) {
  const { type: typeFilter = 'all', month: monthFilter } = await searchParams
  const sb = await getSupabaseServerClient()

  // Build query
  let query = sb
    .from('coach_messages')
    .select('id,type,message,context,period_date,user_comment,is_read,created_at')
    .order('period_date', { ascending: false })
    .order('created_at', { ascending: false })

  if (typeFilter !== 'all') query = query.eq('type', typeFilter as 'daily' | 'weekly' | 'monthly')
  if (monthFilter) {
    const start = `${monthFilter}-01`
    const [y, m] = monthFilter.split('-').map(Number)
    const end = `${monthFilter}-${new Date(y, m, 0).getDate().toString().padStart(2, '0')}`
    query = query.gte('period_date', start).lte('period_date', end)
  }

  const { data: messages } = await query

  // Available months for filter dropdown
  const { data: allMonths } = await sb
    .from('coach_messages')
    .select('period_date')
    .order('period_date', { ascending: false })

  const uniqueMonths = [...new Set(
    (allMonths ?? []).map((m) => m.period_date.slice(0, 7))
  )]

  // Unread count (mark-as-read happens client-side)
  const { count: unreadCount } = await sb
    .from('coach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Coach Pro"
        description="Historial de análisis de tu prospección"
      />
      <div className="flex-1 overflow-y-auto p-8">
        <CoachHistoryClient
          messages={(messages ?? []).map(m => ({ ...m, context: m.context as Record<string, unknown> | null }))}
          uniqueMonths={uniqueMonths}
          typeFilter={typeFilter}
          monthFilter={monthFilter ?? null}
          unreadCount={unreadCount ?? 0}
        />
      </div>
    </div>
  )
}
