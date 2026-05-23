import { getSupabaseServerClient } from '@/lib/supabase/server'
import { SidebarClientShell } from './SidebarClientShell'
import { SidebarNav } from './SidebarNav'
import { SidebarUserSection } from './SidebarUserSection'

export async function Sidebar() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()

  let profile: { full_name: string | null; email: string; avatar_url: string | null; role: string } | null = null
  let isManager = false
  let unreadCoachCount = 0

  if (user) {
    const [{ data }, { count }] = await Promise.all([
      sb.from('profiles').select('full_name, email, avatar_url, role, org_role').eq('id', user.id).single(),
      sb.from('coach_messages').select('id', { count: 'exact', head: true }).eq('is_read', false),
    ])
    profile = data as { full_name: string | null; email: string; avatar_url: string | null; role: string } | null
    isManager = (data as { org_role?: string | null } | null)?.org_role === 'manager'
    unreadCoachCount = count ?? 0
  }

  const isAdmin = profile?.role === 'admin'
  const email = profile?.email ?? user?.email ?? ''

  return (
    <SidebarClientShell
      nav={
        <SidebarNav
          isAdmin={isAdmin}
          isManager={isManager}
          unreadCoachCount={unreadCoachCount}
        />
      }
      user={
        user ? (
          <SidebarUserSection
            fullName={profile?.full_name ?? null}
            email={email}
            avatarUrl={profile?.avatar_url ?? null}
          />
        ) : null
      }
    />
  )
}
