'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import type { SalesPosition } from '@/lib/calculations/recipe'

export async function updateSalesPosition(position: Exclude<SalesPosition, null>): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('No autenticado')

  const { error } = await sb.from('profiles').update({ sales_position: position }).eq('id', user.id)
  if (error) throw error

  revalidatePath('/settings')
  revalidatePath('/recipe')
}
