import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  const sb = await getSupabaseServerClient()
  await sb.auth.signOut()
  return NextResponse.redirect(new URL('/', process.env.NEXT_PUBLIC_SITE_URL ?? 'https://prospectpro-dashboard.vercel.app'), {
    status: 302,
  })
}
