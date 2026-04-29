import { createServerClient } from '@supabase/ssr'
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Routes accessible without authentication
const PUBLIC_ROUTES = ['/', '/login', '/register', '/pending', '/auth/callback', '/auth/signout']

// Routes accessible only to admin role
const ADMIN_PREFIX = '/admin'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // API routes handle their own auth — never redirect them
  if (pathname.startsWith('/api/')) {
    return NextResponse.next()
  }

  // Allow public routes through unconditionally
  if (PUBLIC_ROUTES.some((r) => pathname.startsWith(r))) {
    return NextResponse.next()
  }

  let response = NextResponse.next({
    request: { headers: request.headers },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request: { headers: request.headers } })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // Verify session (getUser() hits Supabase Auth server — more secure than getSession())
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const loginUrl = new URL('/login', request.url)
    return NextResponse.redirect(loginUrl)
  }

  // Fetch profile to check role and onboarding state
  const { data: profile } = await supabase
    .from('profiles')
    .select('role, onboarding_completed')
    .eq('id', user.id)
    .single()

  const role = profile?.role ?? 'pending'

  // Pending users → holding page
  if (role === 'pending') {
    if (pathname !== '/pending') {
      return NextResponse.redirect(new URL('/pending', request.url))
    }
    return response
  }

  // Inactive users → login with error message
  if (role === 'inactive') {
    const url = new URL('/login', request.url)
    url.searchParams.set('error', 'inactive')
    return NextResponse.redirect(url)
  }

  // Admin-only routes
  if (pathname.startsWith(ADMIN_PREFIX) && role !== 'admin') {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }
  // /team: allow active users through — team/page.tsx checks org_role with service client

  // Onboarding: active (non-admin) users who haven't completed it
  if (
    role === 'active' &&
    !profile?.onboarding_completed &&
    !pathname.startsWith('/onboarding')
  ) {
    return NextResponse.redirect(new URL('/onboarding', request.url))
  }

  // Update last_seen_at periodically (fire-and-forget, don't await)
  supabase
    .from('profiles')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)
    .then(() => {})

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths EXCEPT:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico
     * - Files with extensions (images, fonts, etc.)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?|ttf|otf)).*)',
  ],
}
