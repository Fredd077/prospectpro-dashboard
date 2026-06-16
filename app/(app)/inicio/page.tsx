import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'

// Landing dispatcher: decides each user's home page right after login/onboarding.
// Vendedores → /mi-dia · Managers (incl. player-coach) → /dashboard · Admins → /admin.
// Both /mi-dia and /dashboard remain directly accessible from the sidebar for everyone;
// this route only routes the *initial* landing, it is not a guard on those pages.
export const dynamic = 'force-dynamic'

export default async function InicioPage() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') redirect('/admin')
  if (profile?.org_role === 'manager') redirect('/dashboard')
  redirect('/mi-dia')
}
