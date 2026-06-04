import { getSupabaseServerClient } from '@/lib/supabase/server'
import { trialDaysLeft, isTrialExpired } from '@/lib/utils/trial'
import { TrialBannerClient } from './TrialBanner'

export async function TrialBanner() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: profile } = await sb
    .from('profiles')
    .select('role, trial_ends_at')
    .eq('id', user.id)
    .single()

  if (!profile || profile.role === 'admin' || !profile.trial_ends_at) return null

  const daysLeft = trialDaysLeft(profile.trial_ends_at)
  const expired  = isTrialExpired(profile.trial_ends_at)

  return <TrialBannerClient daysLeft={daysLeft} expired={expired} />
}
