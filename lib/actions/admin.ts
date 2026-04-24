'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { sendUserActivatedWelcome } from '@/lib/utils/emails'

async function assertAdmin() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') throw new Error('Not authorized')
  return user
}

export async function activateUser(userId: string) {
  await assertAdmin()
  const service = getSupabaseServiceClient()
  const admin = await getSupabaseServerClient()
  const { data: { user: currentUser } } = await admin.auth.getUser()

  const { data: profile } = await service
    .from('profiles')
    .select('email, full_name, role')
    .eq('id', userId)
    .single()

  await service.from('profiles').update({
    role: 'active',
    activated_at: new Date().toISOString(),
    activated_by: currentUser?.id,
  }).eq('id', userId)

  // Send welcome email only when transitioning to active (not already active)
  if (profile && profile.role !== 'active' && profile.email) {
    try {
      await sendUserActivatedWelcome({
        full_name: profile.full_name ?? null,
        email:     profile.email,
      })
    } catch (err) {
      console.error('[activateUser] welcome email failed:', err)
    }
  }

  revalidatePath('/admin')
}

export async function deactivateUser(userId: string) {
  await assertAdmin()
  const service = getSupabaseServiceClient()
  await service.from('profiles').update({ role: 'inactive' }).eq('id', userId)
  revalidatePath('/admin')
}

export async function updateUserCompany(userId: string, company: string) {
  await assertAdmin()
  const service = getSupabaseServiceClient()
  await service.from('profiles').update({ company: company.trim() || null }).eq('id', userId)
  revalidatePath('/admin')
  revalidatePath(`/admin/users/${userId}`)
  revalidatePath('/team')
}

export async function updateUserOrgRole(userId: string, orgRole: 'member' | 'manager') {
  await assertAdmin()
  const service = getSupabaseServiceClient()
  // If demoting from manager, clear manager_id from users they manage
  if (orgRole === 'member') {
    const { error: clearErr } = await service.from('profiles').update({ manager_id: null } as never).eq('manager_id', userId)
    if (clearErr) throw clearErr
  }
  const { error } = await service.from('profiles').update({ org_role: orgRole } as never).eq('id', userId)
  if (error) throw error
  revalidatePath('/admin')
  revalidatePath('/team')
}

export async function updateUserManager(userId: string, managerId: string | null) {
  await assertAdmin()
  const service = getSupabaseServiceClient()
  await service.from('profiles').update({ manager_id: managerId } as never).eq('id', userId)
  revalidatePath('/admin')
}

export async function deleteUser(userId: string) {
  const caller = await assertAdmin()
  if (caller.id === userId) throw new Error('No puedes eliminarte a ti mismo')

  const service = getSupabaseServiceClient()

  // Clear manager references pointing to this user
  await service.from('profiles').update({ manager_id: null } as never).eq('manager_id', userId)

  // Delete user data (FK cascades handle activity_logs→activities, goals→activities, recipe_actuals→recipe_scenarios)
  await service.from('activities').delete().eq('user_id', userId)
  await service.from('recipe_scenarios').delete().eq('user_id', userId)
  await service.from('coach_messages').delete().eq('user_id', userId)
  await service.from('pipeline_simple').delete().eq('user_id', userId)
  await service.from('pipeline_entries').delete().eq('user_id', userId)
  await service.from('deals').delete().eq('user_id', userId)
  await service.from('profiles').delete().eq('id', userId)

  // Remove from Supabase Auth (must be last)
  const { error } = await service.auth.admin.deleteUser(userId)
  if (error) throw new Error(`Error eliminando auth user: ${error.message}`)

  revalidatePath('/admin')
  revalidatePath('/team')
}
