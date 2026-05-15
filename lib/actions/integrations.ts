'use server'

import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { hashKey } from '@/lib/utils/crypto'
import type { Integration, IntegrationApiKey, WebhookLog } from '@/lib/types/database'
import type { GenericAdapterConfig } from '@/lib/integrations/generic/adapter'

export type PipedriveStageConfig = {
  cita_stage?: string
  reagendar_stage?: string
  reunion_stage: string
  propuesta_stage: string
  cierre_stage: string
  owner_id?: string
}

async function assertUser() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) throw new Error('Not authenticated')
  const { data: profile } = await sb
    .from('profiles')
    .select('role, org_role, company')
    .eq('id', user.id)
    .single()
  if (!profile || profile.role === 'inactive') throw new Error('Not authorized')
  return { user, profile }
}

// Derive a stable company identifier: profile.company → email prefix → user UUID
function resolveCompany(profile: { company?: string | null }, userEmail: string | undefined, userId: string): string {
  if (profile.company) return profile.company
  if (userEmail) return userEmail
  return userId
}

export async function generateIntegrationApiKey(label?: string): Promise<{ plaintext: string }> {
  const { user, profile } = await assertUser()
  const company = resolveCompany(profile, user.email, user.id)

  const service = getSupabaseServiceClient()

  await service.from('integration_api_keys').delete().eq('company_name', company)

  const plaintext = `pp_live_${crypto.randomUUID().replace(/-/g, '')}`
  const hash = await hashKey(plaintext)

  await service.from('integrations').upsert(
    { company_name: company, admin_user_id: user.id },
    { onConflict: 'company_name' }
  )

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
  crmConfig: Pick<Integration, 'crm_name' | 'crm_api_key' | 'crm_base_url'> | null
  pipedriveConfig: PipedriveStageConfig | null
  genericConfig: GenericAdapterConfig | null
}> {
  const { user, profile } = await assertUser()
  const company = resolveCompany(profile, user.email, user.id)

  const service = getSupabaseServiceClient()

  const [{ data: keyRow }, { data: logs }, { data: integration }] = await Promise.all([
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
    service
      .from('integrations')
      .select('crm_name, crm_api_key, crm_base_url, config')
      .eq('company_name', company)
      .maybeSingle(),
  ])

  const rawConfig   = integration?.config as Record<string, unknown> | null
  const pdConfig    = rawConfig?.['pipedrive'] as PipedriveStageConfig | null | undefined
  const genericConf = rawConfig?.['generic'] as GenericAdapterConfig | null | undefined

  return {
    company,
    hasKey:          !!keyRow,
    lastUsedAt:      keyRow?.last_used_at ?? null,
    logs:            (logs ?? []) as WebhookLog[],
    existingKey:     keyRow as IntegrationApiKey | null,
    crmConfig:       integration ?? null,
    pipedriveConfig: pdConfig ?? null,
    genericConfig:   genericConf ?? null,
  }
}

export async function saveCrmConfig(data: {
  crm_name: string
  crm_api_key: string
  crm_base_url: string
}): Promise<void> {
  const { user, profile } = await assertUser()
  const company = resolveCompany(profile, user.email, user.id)

  const service = getSupabaseServiceClient()
  await service.from('integrations').upsert(
    {
      company_name:  company,
      admin_user_id: user.id,
      crm_name:      data.crm_name.trim()     || null,
      crm_api_key:   data.crm_api_key.trim()  || null,
      crm_base_url:  data.crm_base_url.trim() || null,
    },
    { onConflict: 'company_name' }
  )
}

export async function savePipedriveConfig(data: PipedriveStageConfig): Promise<void> {
  const { user, profile } = await assertUser()
  const company = resolveCompany(profile, user.email, user.id)

  const service = getSupabaseServiceClient()

  const { data: existing } = await service
    .from('integrations')
    .select('config')
    .eq('company_name', company)
    .maybeSingle()

  const currentConfig = (existing?.config as Record<string, unknown> | null) ?? {}
  const newConfig = { ...currentConfig, pipedrive: data }

  await service.from('integrations').upsert(
    { company_name: company, admin_user_id: user.id, config: newConfig },
    { onConflict: 'company_name' }
  )
}

export async function saveGenericConfig(data: GenericAdapterConfig): Promise<void> {
  const { user, profile } = await assertUser()
  const company = resolveCompany(profile, user.email, user.id)

  const service = getSupabaseServiceClient()

  const { data: existing } = await service
    .from('integrations')
    .select('config')
    .eq('company_name', company)
    .maybeSingle()

  const currentConfig = (existing?.config as Record<string, unknown> | null) ?? {}
  const newConfig = { ...currentConfig, generic: data }

  await service.from('integrations').upsert(
    { company_name: company, admin_user_id: user.id, config: newConfig },
    { onConflict: 'company_name' }
  )
}
