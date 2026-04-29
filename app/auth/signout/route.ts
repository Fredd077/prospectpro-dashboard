import { NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function POST() {
  const sb = await getSupabaseServerClient()
  await sb.auth.signOut()
  return NextResponse.json({ ok: true })
}
