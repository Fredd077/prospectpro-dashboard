import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { Webhook, Link2, KeyRound, Activity, Database, Settings2 } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { CopyButton } from '@/components/admin/CopyButton'
import { LocalTime } from '@/components/admin/LocalTime'
import { IntegrationsKeyManager } from '@/components/admin/IntegrationsKeyManager'
import { CrmConfigForm } from '@/components/admin/CrmConfigForm'
import { PipedriveConfigForm } from '@/components/admin/PipedriveConfigForm'
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
  const isPipedrive = status.crmConfig?.crm_name?.toLowerCase() === 'pipedrive'

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Integraciones"
        description="Conecta tu CRM o sistema externo vía webhook"
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-10 max-w-3xl">

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

        {/* Pipedrive-specific config — only shown when CRM is Pipedrive */}
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
          {status.logs.length === 0 ? (
            <p className="text-xs text-muted-foreground/50 italic">
              Aún no se han recibido webhooks para esta empresa.
            </p>
          ) : (
            <div className="rounded-lg border border-border bg-card overflow-hidden">
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                      Fecha
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground text-[10px]">
                      Estado
                    </th>
                    <th className="px-4 py-2.5 text-left font-semibold uppercase tracking-wider text-muted-foreground text-[10px] hidden md:table-cell">
                      Payload (preview)
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/40">
                  {status.logs.map((log) => (
                    <tr key={log.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-2.5 font-mono text-muted-foreground whitespace-nowrap">
                        <LocalTime iso={log.created_at} />
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                          log.status === 'processed' || log.status === 'received'
                            ? 'bg-emerald-500/10 text-emerald-400'
                            : log.status === 'skipped'
                            ? 'bg-amber-500/10 text-amber-400'
                            : 'bg-red-500/10 text-red-400'
                        }`}>
                          {log.status}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 font-mono text-muted-foreground/60 max-w-xs truncate hidden md:table-cell">
                        {log.error_message
                          ? <span className="text-red-400/70">{log.error_message}</span>
                          : log.payload
                          ? JSON.stringify(log.payload).slice(0, 80)
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
