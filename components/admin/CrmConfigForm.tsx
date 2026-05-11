'use client'

import { useState, useTransition } from 'react'
import { Save, Eye, EyeOff, CheckCircle2 } from 'lucide-react'
import { saveCrmConfig } from '@/lib/actions/integrations'

interface Props {
  initial: {
    crm_name: string | null
    crm_api_key: string | null
    crm_base_url: string | null
  } | null
}

export function CrmConfigForm({ initial }: Props) {
  const [isPending, startTransition] = useTransition()
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showKey, setShowKey] = useState(false)

  const [crmName,    setCrmName]    = useState(initial?.crm_name    ?? '')
  const [crmApiKey,  setCrmApiKey]  = useState(initial?.crm_api_key  ?? '')
  const [crmBaseUrl, setCrmBaseUrl] = useState(initial?.crm_base_url ?? '')

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaved(false)
    startTransition(async () => {
      try {
        await saveCrmConfig({ crm_name: crmName, crm_api_key: crmApiKey, crm_base_url: crmBaseUrl })
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Error guardando la configuración')
      }
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {/* CRM Name */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nombre del CRM
          </label>
          <input
            type="text"
            value={crmName}
            onChange={(e) => setCrmName(e.target.value)}
            placeholder="ej. HubSpot, Salesforce, Pipedrive…"
            className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>

        {/* CRM Base URL */}
        <div className="space-y-1.5">
          <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            URL base de la API del CRM
          </label>
          <input
            type="url"
            value={crmBaseUrl}
            onChange={(e) => setCrmBaseUrl(e.target.value)}
            placeholder="https://api.tucrm.com/v2"
            className="w-full rounded-md border border-border bg-muted/20 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
        </div>
      </div>

      {/* CRM API Key */}
      <div className="space-y-1.5">
        <label className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          API Key del CRM
        </label>
        <div className="flex items-center gap-2">
          <input
            type={showKey ? 'text' : 'password'}
            value={crmApiKey}
            onChange={(e) => setCrmApiKey(e.target.value)}
            placeholder="Pega aquí el token o API key que te entregó tu CRM"
            className="flex-1 rounded-md border border-border bg-muted/20 px-3 py-2 font-mono text-sm text-foreground placeholder:text-muted-foreground/40 placeholder:font-sans focus:outline-none focus:ring-1 focus:ring-primary/50"
          />
          <button
            type="button"
            onClick={() => setShowKey((v) => !v)}
            className="rounded-md border border-border p-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        <p className="text-[10px] text-muted-foreground/50">
          Se almacena en tu base de datos privada. Solo tú y tu equipo pueden verla.
        </p>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
      >
        {saved ? (
          <CheckCircle2 className="h-4 w-4 text-emerald-300" />
        ) : (
          <Save className="h-4 w-4" />
        )}
        {saved ? 'Guardado' : isPending ? 'Guardando…' : 'Guardar configuración'}
      </button>
    </form>
  )
}
