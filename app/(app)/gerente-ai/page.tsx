import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Suspense } from 'react'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchGerenteAnalytics, presetRange } from '@/lib/utils/gerente-ai'
import { fetchTeamPipeline } from '@/lib/utils/gerente-pipeline'
import { TopBar } from '@/components/layout/TopBar'
import { GerenteDashboard } from '@/components/gerente-ai/GerenteDashboard'
import { PeriodFilter } from '@/components/gerente-ai/PeriodFilter'

export const metadata: Metadata = { title: 'Gerente AI — ProspectPro' }

interface Props {
  searchParams: Promise<{ start?: string; end?: string; preset?: string }>
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export default async function GerenteAIPage({ searchParams }: Props) {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const service = getSupabaseServiceClient()

  const { data: profile } = await service
    .from('profiles')
    .select('id, role, org_role, company, full_name, email, is_player_coach')
    .eq('id', user.id)
    .single()

  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.org_role === 'manager'
  if (!isAdmin && !isManager) redirect('/dashboard')

  // Fetch team members
  let q = service.from('profiles').select('id,full_name,email').in('role', ['active', 'admin'])
  if (isManager && !isAdmin) {
    q = q.eq('company', profile!.company as string).neq('id', user.id)
  }
  const { data: members } = await q

  let allReps = (members ?? []).map((m) => ({
    id:    m.id,
    name:  m.full_name ?? m.email,
    email: m.email,
  }))

  if (isManager && profile?.is_player_coach && !allReps.some((r) => r.id === user.id)) {
    allReps = [{ id: user.id, name: profile.full_name ?? profile.email, email: profile.email }, ...allReps]
  }

  // Resolve date range
  const params = await searchParams
  const preset = (['week', 'month', 'quarter', 'year', 'custom'] as const).includes(params.preset as any)
    ? params.preset as 'week' | 'month' | 'quarter' | 'year' | 'custom'
    : 'month'

  let startISO: string
  let endISO: string

  if (preset === 'custom' && params.start && ISO_RE.test(params.start) && params.end && ISO_RE.test(params.end)) {
    startISO = params.start
    endISO   = params.end
  } else {
    const range = presetRange(preset)
    startISO    = range.start
    endISO      = range.end
  }

  const userIds = allReps.map((r) => r.id)

  // Activity analytics first (needed for momentum scoring in pipeline)
  const analytics = await fetchGerenteAnalytics(service, userIds, startISO, endISO)
  const pipelineWithMomentum = await fetchTeamPipeline(service, userIds, analytics.reps, startISO, endISO)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Gerente AI"
        description={`Analítica de equipo${profile?.company ? ` · ${profile.company}` : ''}`}
      />
      <div className="flex items-center gap-3 px-6 py-2.5 border-b border-border bg-muted/10 shrink-0">
        <Suspense>
          <PeriodFilter
            currentStart={startISO}
            currentEnd={endISO}
            currentPreset={preset}
          />
        </Suspense>
      </div>
      <div className="flex-1 overflow-hidden">
        <GerenteDashboard
          analytics={analytics}
          pipeline={pipelineWithMomentum}
          allReps={allReps}
          startISO={startISO}
          endISO={endISO}
          company={profile?.company ?? undefined}
        />
      </div>
    </div>
  )
}
