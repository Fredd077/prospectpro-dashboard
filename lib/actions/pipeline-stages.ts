'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { assertCanWrite } from '@/lib/utils/authz'
import type { PipelineStage } from '@/lib/types/database'

export type PipelineStageOption = Pick<PipelineStage, 'id' | 'name' | 'color' | 'sort_order'>

/**
 * Lista de etapas del Pipeline del usuario autenticado, ordenada por sort_order.
 * Fuente única de las etapas del Pipeline (independiente del Recetario).
 */
export async function getPipelineStages(): Promise<PipelineStageOption[]> {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return []

  const { data } = await sb
    .from('pipeline_stages')
    .select('id,name,color,sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true })

  return data ?? []
}

/** Inserta una etapa nueva (source 'manual') con sort_order = máximo actual + 1. */
export async function createPipelineStage(name: string): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  const trimmed = name.trim()
  if (!trimmed) throw new Error('El nombre de la etapa no puede estar vacío')

  const { data: maxRow } = await sb
    .from('pipeline_stages')
    .select('sort_order')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: false })
    .limit(1)
    .maybeSingle()

  const nextOrder = (maxRow?.sort_order ?? -1) + 1

  const { error } = await sb
    .from('pipeline_stages')
    .insert({ user_id: user.id, name: trimmed, sort_order: nextOrder, source: 'manual' })

  if (error) throw error
  revalidatePath('/pipeline')
}

/**
 * Renombra una etapa y actualiza EN CASCADA todas las filas de pipeline_simple
 * y pipeline_entries del usuario donde stage = nombre anterior, para que el
 * historial no quede huérfano.
 */
export async function renamePipelineStage(stageId: string, newName: string): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  const trimmed = newName.trim()
  if (!trimmed) throw new Error('El nombre de la etapa no puede estar vacío')

  const { data: stage } = await sb
    .from('pipeline_stages')
    .select('id,name')
    .eq('id', stageId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!stage) throw new Error('Etapa no encontrada')
  if (stage.name === trimmed) return
  const oldName = stage.name

  const { error: renameError } = await sb
    .from('pipeline_stages')
    .update({ name: trimmed })
    .eq('id', stageId)
    .eq('user_id', user.id)
  if (renameError) throw renameError

  // Cascada al historial: pipeline_simple y pipeline_entries.
  const { error: simpleError } = await sb
    .from('pipeline_simple')
    .update({ stage: trimmed })
    .eq('user_id', user.id)
    .eq('stage', oldName)
  if (simpleError) throw simpleError

  const { error: entriesError } = await sb
    .from('pipeline_entries')
    .update({ stage: trimmed })
    .eq('user_id', user.id)
    .eq('stage', oldName)
  if (entriesError) throw entriesError

  revalidatePath('/pipeline')
}

/**
 * Borra una etapa solo si NO tiene registros asociados en pipeline_simple.
 * Si los hay, lanza un error indicando cuántos hay que reasignar primero.
 */
export async function deletePipelineStage(stageId: string): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  const { data: stage } = await sb
    .from('pipeline_stages')
    .select('id,name')
    .eq('id', stageId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (!stage) throw new Error('Etapa no encontrada')

  const { count } = await sb
    .from('pipeline_simple')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('stage', stage.name)

  if ((count ?? 0) > 0) {
    throw new Error(
      `No se puede eliminar "${stage.name}": tiene ${count} registro(s) asociado(s). Reasígnalos a otra etapa primero.`,
    )
  }

  const { error } = await sb
    .from('pipeline_stages')
    .delete()
    .eq('id', stageId)
    .eq('user_id', user.id)

  if (error) throw error
  revalidatePath('/pipeline')
}

/** Reordena las etapas: sort_order = posición en el arreglo recibido. */
export async function reorderPipelineStages(orderedStageIds: string[]): Promise<void> {
  const sb = await getSupabaseServerClient()
  const user = await assertCanWrite(sb)

  for (let i = 0; i < orderedStageIds.length; i++) {
    const { error } = await sb
      .from('pipeline_stages')
      .update({ sort_order: i })
      .eq('id', orderedStageIds[i])
      .eq('user_id', user.id)
    if (error) throw error
  }

  revalidatePath('/pipeline')
}
