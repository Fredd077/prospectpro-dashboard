'use server'

import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'

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

  await service.from('profiles').update({
    role: 'active',
    activated_at: new Date().toISOString(),
    activated_by: currentUser?.id,
  }).eq('id', userId)

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
    await service.from('profiles').update({ manager_id: null } as never).eq('manager_id', userId)
  }
  await service.from('profiles').update({ org_role: orgRole } as never).eq('id', userId)
  revalidatePath('/admin')
}

export async function updateUserManager(userId: string, managerId: string | null) {
  await assertAdmin()
  const service = getSupabaseServiceClient()
  await service.from('profiles').update({ manager_id: managerId } as never).eq('id', userId)
  revalidatePath('/admin')
}
