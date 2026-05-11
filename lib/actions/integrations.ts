'use server'

import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { hashKey } from '@/lib/utils/crypto'
import type { IntegrationApiKey, WebhookLog } from '@/lib/types/database'

async function assertManagerOrAdmin() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role, company')
    .eq('id', user.id)
    .single()
  const isAdmin   = profile?.role === 'admin'
  const isManager = profile?.role === 'active' && profile?.org_role === 'manager'
  if (!isAdmin && !isManager) throw new Error('Not authorized')
  return { user, profile }
}

export async function generateIntegrationApiKey(label?: string): Promise<{ plaintext: string }> {
  const { user, profile } = await assertManagerOrAdmin()
  const company = profile.company
  if (!company) throw new Error('Admin profile has no company assigned')

  const service = getSupabaseServiceClient()

  // Delete all existing keys for this company
  await service.from('integration_api_keys').delete().eq('company_name', company)

  // Generate new key
  const plaintext = `pp_live_${crypto.randomUUID().replace(/-/g, '')}`
  const hash = await hashKey(plaintext)

  // Upsert the integrations anchor row
  await service.from('integrations').upsert(
    { company_name: company, admin_user_id: user.id },
    { onConflict: 'company_name' }
  )

  // Insert hashed key
  await service.from('integration_api_keys').insert({
    company_name: company,
    key_hash: hash,
    label: label ?? null,
  })

  return { plaintext }
}

export async function getIntegrationStatus(): Promise<{
  company: string
  hasKey: boolean
  lastUsedAt: string | null
  logs: WebhookLog[]
  existingKey: IntegrationApiKey | null
}> {
  const { profile } = await assertManagerOrAdmin()
  const company = profile.company ?? ''

  const service = getSupabaseServiceClient()

  const [{ data: keyRow }, { data: logs }] = await Promise.all([
    service
      .from('integration_api_keys')
      .select('*')
      .eq('company_name', company)
      .maybeSingle(),
    service
      .from('webhook_logs')
      .select('*')
      .eq('company_name', company)
      .order('created_at', { ascending: false })
      .limit(20),
  ])

  return {
    company,
    hasKey: !!keyRow,
    lastUsedAt: keyRow?.last_used_at ?? null,
    logs: (logs ?? []) as WebhookLog[],
    existingKey: keyRow as IntegrationApiKey | null,
  }
}
