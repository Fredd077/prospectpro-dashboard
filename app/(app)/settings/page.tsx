import type { Metadata } from 'next'
import { TopBar } from '@/components/layout/TopBar'
import { SalesPositionPicker } from '@/components/settings/SalesPositionPicker'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Ajustes',
  description: 'Preferencias de tu cuenta',
}

export default async function SettingsPage() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  const { data: profile } = await sb
    .from('profiles')
    .select('sales_position')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  return (
    <div className="flex flex-col h-full">
      <TopBar title="Ajustes" description="Preferencias de tu cuenta" />
      <div className="flex-1 overflow-y-auto p-8 max-w-2xl">
        <div className="rounded-lg border border-border bg-card p-5">
          <SalesPositionPicker current={profile?.sales_position ?? null} />
        </div>
      </div>
    </div>
  )
}
