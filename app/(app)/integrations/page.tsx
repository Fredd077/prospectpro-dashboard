import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Webhook, Link2, KeyRound, Activity, Database, Settings2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { CopyButton } from '@/components/admin/CopyButton'
import { IntegrationsKeyManager } from '@/components/admin/IntegrationsKeyManager'
import { CrmConfigForm } from '@/components/admin/CrmConfigForm'
import { PipedriveConfigForm } from '@/components/admin/PipedriveConfigForm'
import { PipedriveSetupGuide } from '@/components/admin/PipedriveSetupGuide'
import { GenericAdapterConfigForm } from '@/components/admin/GenericAdapterConfigForm'
import { WebhookLogsTable } from '@/components/admin/WebhookLogsTable'
import { getIntegrationStatus } from '@/lib/actions/integrations'

export const metadata: Metadata = { title: 'Integraciones — ProspectPro' }

function SectionHeader({ icon: Icon, children }: { icon: React.ComponentType<{ className?: string }>; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-2">
      <Icon className="h-4 w-4 text-muted-foreground/60" />
      <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
        {children}
      </p>
    </div>
  )
}

export default async function IntegrationsPage() {
  let status: Awaited<ReturnType<typeof getIntegrationStatus>>
  try {
    status = await getIntegrationStatus()
  } catch {
    redirect('/dashboard')
  }

  const webhookUrl = `https://app.prospectpro.cloud/api/webhooks/inbound/${encodeURIComponent(status.company)}`
  const isPipedrive       = status.crmConfig?.crm_name?.toLowerCase() === 'pipedrive'
  const hasGenericStageMap = Object.keys(status.genericConfig?.stage_map ?? {}).length > 0
  const isFullyConfigured = status.hasKey && (
    (isPipedrive && !!status.pipedriveConfig?.reunion_stage) ||
    (!isPipedrive && !!status.crmConfig?.crm_name && hasGenericStageMap)
  )

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Integraciones"
        description="Conecta tu CRM o sistema externo vía webhook"
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-10 max-w-3xl">

        {/* Setup guide — Pipedrive only; generic users get inline instructions */}
        {isPipedrive && <PipedriveSetupGuide isConfigured={isFullyConfigured} />}
        {!isPipedrive && !status.crmConfig?.crm_name && (
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 space-y-3">
            <p className="text-sm font-bold text-foreground">Conecta tu CRM en 3 pasos</p>
            <ol className="space-y-2 text-xs text-muted-foreground">
              <li className="flex gap-2"><span className="font-bold text-cyan-400">1.</span> En "Credenciales de tu CRM", escribe el nombre de tu CRM (ej: HubSpot, Salesforce, Zoho) y guarda.</li>
              <li className="flex gap-2"><span className="font-bold text-cyan-400">2.</span> Genera tu API Key de ProspectPro y copia la URL del webhook.</li>
              <li className="flex gap-2"><span className="font-bold text-cyan-400">3.</span> En tu CRM, crea un webhook con esa URL + <code className="font-mono">?key=TU_CLAVE</code> y configura el mapeo de etapas en la sección de abajo.</li>
            </ol>
            <p className="text-[11px] text-muted-foreground/60">Compatible con HubSpot, Salesforce, Zoho CRM, Monday.com, Close, Freshsales y cualquier CRM con webhooks JSON.</p>
          </div>
        )}

        {/* Webhook URL */}
        <div className="space-y-3">
          <SectionHeader icon={Link2}>Endpoint del webhook</SectionHeader>
          <p className="text-xs text-muted-foreground">
            Configura esta URL como destino en tu CRM o sistema externo.
            Acepta <code className="font-mono text-primary/80">HTTP POST</code> con JSON.
          </p>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2.5">
            <Webhook className="h-4 w-4 text-muted-foreground/50 shrink-0" />
            <code className="flex-1 font-mono text-xs text-foreground break-all">
              {webhookUrl}
            </code>
            <CopyButton text={webhookUrl} />
          </div>
          <div className="rounded border border-border bg-muted/10 p-3 space-y-1.5 text-xs text-muted-foreground">
            <p className="font-semibold text-foreground/70">Autenticación</p>
            <p>Incluye el header <code className="font-mono text-primary/80">x-prospectpro-key: {'<tu-clave>'}</code> en cada request.</p>
            <p className="text-muted-foreground/60">Alternativa: parámetro de query <code className="font-mono">?key={'<tu-clave>'}</code></p>
          </div>
        </div>

        {/* CRM Config */}
        <div className="space-y-3">
          <SectionHeader icon={Database}>Credenciales de tu CRM</SectionHeader>
          <p className="text-xs text-muted-foreground">
            Registra aquí la API key que tu CRM te entregó. ProspectPro la usará para enviarle datos de vuelta.
          </p>
          <CrmConfigForm initial={status.crmConfig} />
        </div>

        {/* Pipedrive-specific config */}
        {isPipedrive && (
          <div className="space-y-3">
            <SectionHeader icon={Settings2}>Configuración de Pipedrive</SectionHeader>
            <p className="text-xs text-muted-foreground">
              Mapea las etapas de tu pipeline en Pipedrive con las etapas de ProspectPro.
              Los deals que lleguen por webhook se sincronizarán automáticamente.
            </p>
            <PipedriveConfigForm initial={status.pipedriveConfig} />
          </div>
        )}

        {/* Generic adapter config — shown for any non-Pipedrive CRM */}
        {!isPipedrive && (
          <div className="space-y-3">
            <SectionHeader icon={Settings2}>
              Configuración de integración{status.crmConfig?.crm_name ? ` — ${status.crmConfig.crm_name}` : ''}
            </SectionHeader>
            <GenericAdapterConfigForm initial={status.genericConfig} />
          </div>
        )}

        {/* API Key (inbound) */}
        <div className="space-y-3">
          <SectionHeader icon={KeyRound}>API Key de ProspectPro</SectionHeader>
          <p className="text-xs text-muted-foreground">
            Solo existe una clave activa por empresa. Al regenerar, la anterior queda inválida de inmediato.
          </p>
          <IntegrationsKeyManager
            hasExistingKey={status.hasKey}
            lastUsedAt={status.lastUsedAt}
            webhookUrl={webhookUrl}
          />
        </div>

        {/* Webhook Logs */}
        <div className="space-y-3">
          <SectionHeader icon={Activity}>Últimas llamadas</SectionHeader>
          <p className="text-xs text-muted-foreground">
            Haz clic en cualquier fila para ver el mensaje completo y el payload JSON.
          </p>
          <WebhookLogsTable logs={status.logs} />
        </div>

      </div>
    </div>
  )
}
