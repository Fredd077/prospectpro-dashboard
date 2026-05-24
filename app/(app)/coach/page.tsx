import type { Metadata } from 'next'
import { TopBar } from '@/components/layout/TopBar'
import { IntelligenceHistoryClient } from '@/components/coach/IntelligenceHistoryClient'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { IntelligenceReportCardProps } from '@/components/coach/IntelligenceReportCard'

export const metadata: Metadata = {
  title: 'Reportes Coach IA — ProspectPro',
  description: 'Todos tus reportes de prospección en un lugar',
}

export default async function CoachPage() {
  const sb = await getSupabaseServerClient()

  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const [{ data: profile }, { data: vendedorRows }, { data: gerenteRows }] = await Promise.all([
    sb.from('profiles').select('org_role').eq('id', user.id).maybeSingle(),
    sb.from('intelligence_reports')
      .select('id,report_audience,period_type,period_start,period_end,report_content,confidence_level,periods_analyzed,created_at')
      .eq('user_id', user.id)
      .eq('report_audience', 'vendedor')
      .order('period_start', { ascending: false })
      .order('created_at', { ascending: false }),
    sb.from('intelligence_reports')
      .select('id,report_audience,period_type,period_start,period_end,report_content,confidence_level,periods_analyzed,created_at')
      .eq('user_id', user.id)
      .eq('report_audience', 'gerente')
      .order('period_start', { ascending: false })
      .order('created_at', { ascending: false }),
  ])

  const isManager = profile?.org_role === 'manager'

  const toCardProps = (row: typeof vendedorRows extends (infer R)[] | null ? R : never): IntelligenceReportCardProps => ({
    id: row.id as string,
    report_audience: row.report_audience as 'vendedor' | 'gerente',
    period_type: row.period_type as 'daily' | 'weekly' | 'monthly',
    period_start: row.period_start as string,
    period_end: row.period_end as string,
    report_content: row.report_content,
    confidence_level: row.confidence_level as string | null,
    periods_analyzed: row.periods_analyzed as number | null,
    created_at: row.created_at as string,
  })

  const vendedorReports = (vendedorRows ?? []).map(toCardProps)
  const gerenteReports = (gerenteRows ?? []).map(toCardProps)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Reportes Coach IA"
        description="Historial de análisis de tu prospección"
      />
      <div className="flex-1 overflow-y-auto p-8">
        <IntelligenceHistoryClient
          vendedorReports={vendedorReports}
          gerenteReports={gerenteReports}
          isManager={isManager}
        />
      </div>
    </div>
  )
}
