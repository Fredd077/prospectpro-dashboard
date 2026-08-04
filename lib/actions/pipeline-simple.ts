'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { assertCanWrite } from '@/lib/utils/authz'

// stage es TEXT libre: la lista de etapas es propia de cada usuario (pipeline_stages)
// y totalmente editable, así que no se restringe a un union de literales.
type Status = 'abierto' | 'perdido' | 'ganado'
type ProspectType = 'inbound' | 'outbound'

export async function createPipelineSimple(data: {
  stage: string
  status?: Status
  prospect_type?: ProspectType
  entry_date: string
  company_name?: string | null
  prospect_name?: string | null
  amount_usd?: number | null
  notes?: string | null
  origin_activity_id?: string | null
}): Promise<string> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  const { data: row, error } = await sb
    .from('pipeline_simple')
    .insert({
      user_id:            user.id,
      stage:              data.stage,
      status:             data.status ?? 'abierto',
      prospect_type:      data.prospect_type ?? 'outbound',
      entry_date:         data.entry_date,
      company_name:       data.company_name?.trim() ?? null,
      prospect_name:      data.prospect_name?.trim() ?? null,
      amount_usd:         data.amount_usd ?? null,
      notes:              data.notes?.trim() ?? null,
      origin_activity_id: data.origin_activity_id ?? null,
    })
    .select('id')
    .single()

  if (error) {
    console.error('[createPipelineSimple]', error.message, error.details)
    throw new Error(error.message)
  }

  revalidatePath('/pipeline')
  return row.id
}

export async function updatePipelineSimple(
  id: string,
  data: {
    stage?: string
    status?: Status
    prospect_type?: ProspectType
    entry_date?: string
    company_name?: string | null
    prospect_name?: string | null
    amount_usd?: number | null
    notes?: string | null
    origin_activity_id?: string | null
  },
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  const { error } = await sb
    .from('pipeline_simple')
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    console.error('[updatePipelineSimple]', error.message, error.details)
    throw new Error(error.message)
  }
  revalidatePath('/pipeline')
}

export async function updatePipelineSimpleStatus(
  id: string,
  status: Status,
): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

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
  const user = await assertCanWrite(sb)

  const { error } = await sb
    .from('pipeline_simple')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/pipeline')
}
