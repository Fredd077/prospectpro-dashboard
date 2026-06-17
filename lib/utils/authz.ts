import type { SupabaseClient, User } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

/** Mensaje de modo solo lectura cuando el período de prueba terminó. */
export const READ_ONLY_MESSAGE =
  'Tu período de prueba terminó. Estás en modo solo lectura: contacta a tu administrador para reactivar tu cuenta.'

/**
 * Verifica que el usuario autenticado pueda ESCRIBIR:
 *  - admin: siempre
 *  - active con trial vigente (o sin trial): sí
 *  - active con trial vencido: NO (modo solo lectura)
 *  - cualquier otro estado: NO
 *
 * Lanza con un mensaje claro en vez de dejar que la escritura falle en silencio
 * (muchas server actions no revisan el error de Supabase). La barrera real está
 * en RLS (migración 038); esto es para dar buena UX y evitar no-ops silenciosos.
 */
export async function assertCanWrite(sb: SupabaseClient<Database>): Promise<User> {
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { data: profile } = await sb
    .from('profiles')
    .select('role, trial_ends_at')
    .eq('id', user.id)
    .single()

  if (!profile) throw new Error('Perfil no encontrado')
  if (profile.role === 'admin') return user
  if (profile.role !== 'active') throw new Error('Tu cuenta no está activa.')
  if (profile.trial_ends_at && new Date(profile.trial_ends_at) < new Date()) {
    throw new Error(READ_ONLY_MESSAGE)
  }
  return user
}
