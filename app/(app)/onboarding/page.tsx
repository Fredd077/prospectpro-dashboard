import type { Metadata } from 'next'
import { TrendingUp } from 'lucide-react'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { OnboardingWizard } from '@/components/onboarding/OnboardingWizard'

export const metadata: Metadata = { title: 'Configuración inicial — ProspectPro' }

export default async function OnboardingPage() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await sb
    .from('profiles')
    .select('full_name, onboarding_completed')
    .eq('id', user.id)
    .single()

  // Admin or already completed → go to dashboard
  if (profile?.onboarding_completed) redirect('/dashboard')

  return (
    <div className="flex min-h-full flex-col items-center justify-center p-6 gap-6">
      {/* Brand header */}
      <div className="flex items-center gap-3">
        <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-primary">
          <TrendingUp className="h-5 w-5 text-primary-foreground" />
          <span className="pulse-dot absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
        </div>
        <span className="text-base font-bold tracking-tight">ProspectPro</span>
      </div>

      <OnboardingWizard userName={profile?.full_name ?? null} />
    </div>
  )
}
