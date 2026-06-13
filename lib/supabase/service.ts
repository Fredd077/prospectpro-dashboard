import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Service role client — bypasses RLS. NEVER use on the client side.
// Lives in its own module (no `next/headers` import) so it can also be
// imported from standalone Node scripts like scripts/seed-demo.ts.
export function getSupabaseServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}
