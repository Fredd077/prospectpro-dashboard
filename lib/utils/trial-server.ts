import { getSupabaseServerClient } from '@/lib/supabase/server'

/** Call at the top of any mutating server action to block trial-expired users. */
export async function trialGuard(): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { data: profile } = await sb
    .from('profiles')
    .select('role, trial_ends_at')
    .eq('id', user.id)
    .single()

  if (profile?.role === 'admin') return

  if (profile?.trial_ends_at && new Date(profile.trial_ends_at) < new Date()) {
    throw new Error('Tu período de prueba ha expirado. Contacta a tu administrador para activar tu cuenta.')
  }
}
