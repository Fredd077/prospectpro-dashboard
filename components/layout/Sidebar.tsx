import { TrendingUp } from 'lucide-react'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { SidebarNav } from './SidebarNav'
import { SidebarUserSection } from './SidebarUserSection'

export async function Sidebar() {
  const sb = await getSupabaseServerClient()
  const {
    data: { user },
  } = await sb.auth.getUser()

  let profile: { full_name: string | null; email: string; avatar_url: string | null; role: string } | null = null

  if (user) {
    const { data } = await sb
      .from('profiles')
      .select('full_name, email, avatar_url, role')
      .eq('id', user.id)
      .single()
    profile = data
  }

  const isAdmin = profile?.role === 'admin'
  const email = profile?.email ?? user?.email ?? ''

  const { count: unreadCoachCount } = await sb
    .from('coach_messages')
    .select('id', { count: 'exact', head: true })
    .eq('is_read', false)

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-border bg-sidebar transition-all lg:w-60">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center justify-center border-b border-border px-4 lg:justify-start lg:gap-3 lg:px-5">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
          <span className="pulse-dot absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
        </div>
        <div className="hidden lg:block">
          <span className="text-sm font-bold tracking-tight text-foreground">ProspectPro</span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="h-1 w-1 rounded-full bg-primary" />
            <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60">
              Command Center
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <SidebarNav isAdmin={isAdmin} unreadCoachCount={unreadCoachCount ?? 0} />

      {/* User + sign-out */}
      {user && (
        <SidebarUserSection
          fullName={profile?.full_name ?? null}
          email={email}
          avatarUrl={profile?.avatar_url ?? null}
        />
      )}
    </aside>
  )
}
