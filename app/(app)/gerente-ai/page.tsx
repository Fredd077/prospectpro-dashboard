import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { fetchGerenteAnalytics } from '@/lib/utils/gerente-ai'
import { TopBar } from '@/components/layout/TopBar'
import { GerenteDashboard } from '@/components/gerente-ai/GerenteDashboard'

export const metadata: Metadata = { title: 'Gerente AI — ProspectPro' }

export default async function GerenteAIPage() {
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
  let q = service.from('profiles').select('id,full_name,email,company').in('role', ['active', 'admin'])
  if (isManager && !isAdmin) {
    q = q.eq('company', profile!.company as string).neq('id', user.id)
  }
  const { data: members } = await q

  let allReps = (members ?? []).map((m) => ({
    id:    m.id,
    name:  m.full_name ?? m.email,
    email: m.email,
  }))

  // Player-coach: include manager themselves
  if (isManager && profile?.is_player_coach && !allReps.some((r) => r.id === user.id)) {
    allReps = [
      { id: user.id, name: profile.full_name ?? profile.email, email: profile.email },
      ...allReps,
    ]
  }

  const userIds = allReps.map((r) => r.id)
  const weeksBack = 12

  const analytics = await fetchGerenteAnalytics(service, userIds, weeksBack)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Gerente AI"
        description={`Analítica de alto nivel${profile?.company ? ` · ${profile.company}` : ''}`}
      />
      <div className="flex-1 overflow-hidden">
        <GerenteDashboard
          analytics={analytics}
          allReps={allReps}
          weeksBack={weeksBack}
          company={profile?.company ?? undefined}
        />
      </div>
    </div>
  )
}
