import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const sb = await getSupabaseServerClient()
  await sb.auth.signOut()
  const origin = request.nextUrl.origin
  return NextResponse.redirect(`${origin}/`)
}

export async function POST() {
  const sb = await getSupabaseServerClient()
  await sb.auth.signOut()
  return NextResponse.json({ ok: true })
}
