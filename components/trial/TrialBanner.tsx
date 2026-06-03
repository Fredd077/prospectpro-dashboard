import { getSupabaseServerClient } from '@/lib/supabase/server'
import { trialDaysLeft, isTrialExpired } from '@/lib/utils/trial'
// trial.ts is pure utils — safe to import in server components
import { AlertTriangle, Clock } from 'lucide-react'

export async function TrialBanner() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null

  const { data: profile } = await sb
    .from('profiles')
    .select('role, trial_ends_at')
    .eq('id', user.id)
    .single()

  // Admins and users without trial never see the banner
  if (!profile || profile.role === 'admin' || !profile.trial_ends_at) return null

  const daysLeft = trialDaysLeft(profile.trial_ends_at)
  const expired  = isTrialExpired(profile.trial_ends_at)

  // Only show banner when 7 days or fewer remain, or expired
  if (daysLeft !== null && daysLeft > 7) return null

  if (expired) {
    return (
      <div className="flex items-center gap-3 border-b border-red-500/30 bg-red-500/8 px-6 py-2.5">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
        <p className="text-sm text-red-300 font-medium">
          Tu período de prueba ha expirado.{' '}
          <span className="text-red-400 font-semibold">Solo puedes ver tus datos.</span>{' '}
          Contacta a tu administrador para activar tu cuenta.
        </p>
      </div>
    )
  }

  const urgency = daysLeft !== null && daysLeft <= 1
    ? { bg: 'bg-orange-500/8 border-orange-500/30', text: 'text-orange-300', icon: 'text-orange-400', label: daysLeft === 0 ? 'hoy expira' : 'queda 1 día' }
    : daysLeft !== null && daysLeft <= 3
    ? { bg: 'bg-amber-500/8 border-amber-500/30', text: 'text-amber-300', icon: 'text-amber-400', label: `quedan ${daysLeft} días` }
    : { bg: 'bg-blue-500/8 border-blue-500/30', text: 'text-blue-300', icon: 'text-blue-400', label: `quedan ${daysLeft} días` }

  return (
    <div className={`flex items-center gap-3 border-b px-6 py-2 ${urgency.bg}`}>
      <Clock className={`h-3.5 w-3.5 shrink-0 ${urgency.icon}`} />
      <p className={`text-xs font-medium ${urgency.text}`}>
        Período de prueba gratuita —{' '}
        <span className="font-semibold">{urgency.label}</span>.{' '}
        Contacta a tu administrador para activar tu cuenta.
      </p>
    </div>
  )
}
