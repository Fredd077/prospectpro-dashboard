import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { AiConfigEditor } from '@/components/admin/AiConfigEditor'
import { getSupabaseServerClient, getSupabaseServiceClient } from '@/lib/supabase/server'
import { getAllAiConfigs } from '@/lib/utils/ai-config'

export const metadata: Metadata = { title: 'Configuración AI — ProspectPro' }

export default async function AiConfigPage() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('role').eq('id', user.id).single()
  if (profile?.role !== 'admin') redirect('/admin')

  const service = getSupabaseServiceClient()
  const configs = await getAllAiConfigs(service)

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Configuración AI"
        description="Personaliza los prompts y parámetros de cada sección de IA"
      />
      <div className="flex-1 overflow-hidden">
        <AiConfigEditor initialConfigs={configs} />
      </div>
    </div>
  )
}
