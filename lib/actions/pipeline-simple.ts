'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'

type Stage = 'Reunión' | 'Propuesta' | 'Cierre'
type Status = 'abierto' | 'perdido' | 'ganado'
type ProspectType = 'inbound' | 'outbound'

export async function createPipelineSimple(data: {
  stage: Stage
  status?: Status
  prospect_type?: ProspectType
  entry_date: string
  company_name?: string | null
  prospect_name?: string | null
  amount_usd?: number | null
  notes?: string | null
}): Promise<string> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: row, error } = await sb
    .from('pipeline_simple')
    .insert({
      user_id:       user.id,
      stage:         data.stage,
      status:        data.status ?? 'abierto',
      prospect_type: data.prospect_type ?? 'outbound',
      entry_date:    data.entry_date,
      company_name:  data.company_name?.trim() ?? null,
      prospect_name: data.prospect_name?.trim() ?? null,
      amount_usd:    data.amount_usd ?? null,
      notes:         data.notes?.trim() ?? null,
    })
    .select('id')
    .single()

  if (error) throw error

  revalidatePath('/pipeline')
  return row.id
}

export async function updatePipelineSimple(
  id: string,
  data: {
    stage?: Stage
    status?: Status
    prospect_type?: ProspectType
    entry_date?: string
    company_name?: string | null
    prospect_name?: string | null
    amount_usd?: number | null
    notes?: string | null
  },
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('pipeline_simple')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/pipeline')
}

export async function updatePipelineSimpleStatus(
  id: string,
  status: Status,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('pipeline_simple')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/pipeline')
}

export async function deletePipelineSimple(id: string): Promise<void> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await sb
    .from('pipeline_simple')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/pipeline')
}
