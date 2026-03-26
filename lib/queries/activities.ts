import { getSupabaseBrowserClient } from '@/lib/supabase/client'
import type { ActivityInsert, ActivityUpdate } from '@/lib/types/database'

export async function fetchActivities(includeInactive = false) {
  const sb = getSupabaseBrowserClient()
  let query = sb
    .from('activities')
    .select('*')
    .order('sort_order', { ascending: true })
    .order('name', { ascending: true })

  if (!includeInactive) {
    query = query.eq('status', 'active')
  }

  const { data, error } = await query
  if (error) throw error
  return data
}

export async function fetchActivity(id: string) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()
  if (error) throw error
  return data
}

export async function createActivity(payload: ActivityInsert) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('activities')
    .insert(payload)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateActivity(id: string, payload: ActivityUpdate) {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('activities')
    .update(payload)
    .eq('id', id)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function deleteActivity(id: string) {
  const sb = getSupabaseBrowserClient()
  const { error } = await sb.from('activities').delete().eq('id', id)
  if (error) throw error
}

export async function fetchChannels(): Promise<string[]> {
  const sb = getSupabaseBrowserClient()
  const { data, error } = await sb
    .from('activities')
    .select('channel')
    .order('channel')
  if (error) throw error
  const unique = [...new Set(data?.map((r) => r.channel) ?? [])]
  return unique.sort()
}
