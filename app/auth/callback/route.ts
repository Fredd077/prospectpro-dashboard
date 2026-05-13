import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import type { NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const errorParam = searchParams.get('error')
  const errorCode = searchParams.get('error_code')
  const errorDescription = searchParams.get('error_description')
  const next = searchParams.get('next') ?? '/dashboard'

  // Supabase returned an error before reaching our callback
  if (errorParam) {
    console.error('[auth/callback] Supabase OAuth error:', {
      error: errorParam,
      error_code: errorCode,
      error_description: errorDescription,
      url: request.url,
    })
    return NextResponse.redirect(`${origin}/login?error=oauth`)
  }

  if (code) {
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: sessionData, error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      // Notify admin if this is a brand-new registration (profile created within last 2 min)
      const userId = sessionData.user?.id
      if (userId) {
        Promise.resolve(
          supabase
            .from('profiles')
            .select('email, full_name, company, role, created_at')
            .eq('id', userId)
            .single()
        ).then(({ data: profile }) => {
          if (!profile || profile.role !== 'pending') return
          const ageMs = Date.now() - new Date(profile.created_at).getTime()
          if (ageMs > 2 * 60 * 1000) return
          fetch(`${origin}/api/notify/new-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              email:     profile.email,
              full_name: profile.full_name,
              company:   profile.company,
            }),
          }).catch((err) => console.error('[auth/callback] notify failed:', err))
        }).catch(() => {})
      }

      // proxy.ts handles role-based redirect from /dashboard
      return NextResponse.redirect(`${origin}${next}`)
    }
    console.error('[auth/callback] exchangeCodeForSession failed:', {
      message: error.message,
      status: error.status,
    })
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`)
}
