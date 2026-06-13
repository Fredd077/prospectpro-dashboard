import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from '@/lib/types/database'

// Service role client lives in ./service (no next/headers import) so it can be
// reused by standalone scripts. Re-exported here for backward compatibility.
export { getSupabaseServiceClient } from './service'

export async function getSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // Cookies can't be set in Server Components — safe to ignore
          }
        },
      },
    }
  )
}
