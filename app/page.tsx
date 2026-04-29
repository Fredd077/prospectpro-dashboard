import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import LandingPage from '@/components/landing/LandingPage'

export const metadata: Metadata = {
  title: 'ProspectPro — Tu War Room Comercial con IA',
  description: 'Coach IA diario, pipeline en tiempo real y reportes automáticos para equipos de ventas B2B en LATAM.',
}

export default async function RootPage() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (user) redirect('/dashboard')
  return <LandingPage />
}
