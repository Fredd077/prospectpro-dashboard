'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Eye, EyeOff, RefreshCw, Unplug, CheckCircle2, AlertTriangle, Zap } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CopyButton } from '@/components/admin/CopyButton'
import { HUBSPOT_SETUP_STEPS, HUBSPOT_WEBHOOK_STEPS, type GuideStep } from '@/lib/integrations/hubspot/setup-guide'

interface Props {
  connected: boolean
  syncStatus: 'pending' | 'active' | 'error' | 'disconnected' | null
  lastSyncAt: string | null
  lastWebhookAt: string | null
  lastError: string | null
  hubDomain: string | null
  hasClientSecret: boolean
  webhookUrl: string
}

interface HsStage { id: string; label: string; isClosed: boolean; probability: number }
interface HsPipeline { id: string; label: string; stages: HsStage[] }
interface OwnerRow {
  hubspotOwnerId: string
  hubspotEmail: string | null
  hubspotName: string | null
  mappedUserId: string | null
  autoMatched: boolean
}
interface Candidate { id: string; email: string | null; fullName: string | null }

const input =
  'w-full rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60'

/** Renderiza `**negrita**` sin meter una librería de markdown por dos asteriscos. */
function Bold({ text }: { text: string }) {
  return (
    <>
      {text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
        part.startsWith('**') && part.endsWith('**')
          ? <strong key={i} className="text-foreground">{part.slice(2, -2)}</strong>
          : <span key={i}>{part}</span>,
      )}
    </>
  )
}

function Guide({ steps, startAt = 1 }: { steps: GuideStep[]; startAt?: number }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-2.5 text-xs text-muted-foreground leading-relaxed">
          <span className="shrink-0 font-bold text-cyan-400 tabular-nums">{startAt + i}.</span>
          <span>
            <Bold text={s.text} />
            {s.hint && <span className="block mt-0.5 text-[11px] text-muted-foreground/60"><Bold text={s.hint} /></span>}
          </span>
        </li>
      ))}
    </ol>
  )
}

export function HubSpotPanel(props: Props) {
  const router = useRouter()
  const [token, setToken] = useState('')
  const [showToken, setShowToken] = useState(false)
  const [busy, setBusy] = useState(false)

  const [pipelines, setPipelines] = useState<HsPipeline[] | null>(null)
  const [ppStages, setPpStages] = useState<string[]>([])
  const [pipelineId, setPipelineId] = useState<string | null>(null)
  const [stageMap, setStageMap] = useState<Record<string, string>>({})
  const [owners, setOwners] = useState<OwnerRow[] | null>(null)
  const [candidates, setCandidates] = useState<Candidate[]>([])
  const [ownerMap, setOwnerMap] = useState<Record<string, string>>({})
  const [secret, setSecret] = useState('')

  const loadConfig = useCallback(async () => {
    try {
      const [pRes, oRes] = await Promise.all([
        fetch('/api/integrations/hubspot/pipelines'),
        fetch('/api/integrations/hubspot/owners'),
      ])
      if (pRes.ok) {
        const d = await pRes.json()
        setPipelines(d.pipelines ?? [])
        setPpStages(d.prospectProStages ?? [])
        setPipelineId(d.selectedPipelineId ?? d.pipelines?.[0]?.id ?? null)
        setStageMap(d.stageMapping ?? {})
      }
      if (oRes.ok) {
        const d = await oRes.json()
        setOwners(d.owners ?? [])
        setCandidates(d.candidates ?? [])
        const initial: Record<string, string> = {}
        for (const o of d.owners ?? []) if (o.mappedUserId) initial[o.hubspotOwnerId] = o.mappedUserId
        setOwnerMap(initial)
      }
    } catch {
      toast.error('No se pudo cargar la configuración de HubSpot')
    }
  }, [])

  useEffect(() => { if (props.connected) loadConfig() }, [props.connected, loadConfig])

  async function connect() {
    if (!token.trim()) return toast.error('Pega tu token de acceso')
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/hubspot/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: token.trim() }),
      })
      const d = await res.json()
      if (!res.ok) return toast.error(d.error ?? 'No se pudo conectar')
      toast.success('HubSpot conectado ✓')
      setToken('')
      router.refresh()
    } finally { setBusy(false) }
  }

  async function saveMapping() {
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/hubspot/mapping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pipelineId, stageMapping: stageMap, ownerMapping: ownerMap,
          ...(secret.trim() && { clientSecret: secret.trim() }),
        }),
      })
      const d = await res.json()
      if (!res.ok) return toast.error(d.error ?? 'No se pudo guardar')
      toast.success(d.warning ?? 'Configuración guardada ✓')
      setSecret('')
      router.refresh()
    } finally { setBusy(false) }
  }

  async function syncNow() {
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/hubspot/sync', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) return toast.error(d.error ?? 'No se pudo sincronizar')
      toast.success(`Listo: ${d.created} creados, ${d.updated} actualizados, ${d.skipped} omitidos`)
      for (const n of d.notes ?? []) toast.warning(n)
      router.refresh()
    } finally { setBusy(false) }
  }

  async function disconnect() {
    if (!confirm('¿Desconectar HubSpot? Se eliminará el token guardado en ProspectPro.')) return
    setBusy(true)
    try {
      const res = await fetch('/api/integrations/hubspot/disconnect', { method: 'POST' })
      const d = await res.json()
      if (!res.ok) return toast.error(d.error ?? 'No se pudo desconectar')
      toast.success(d.note ?? 'Desconectado')
      router.refresh()
    } finally { setBusy(false) }
  }

  // ── Sin conexión: guía + token ────────────────────────────────────────────
  if (!props.connected) {
    return (
      <div className="space-y-5">
        <div className="rounded-xl border border-cyan-500/20 bg-cyan-500/5 p-5 space-y-3">
          <p className="text-sm font-bold text-foreground">¿Cómo obtengo mi token de HubSpot?</p>
          <p className="text-[11px] text-muted-foreground/70">
            Lo hace una sola vez alguien con permisos de administrador en HubSpot.
          </p>
          <Guide steps={HUBSPOT_SETUP_STEPS} />
        </div>

        <div className="space-y-2">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Token de acceso de HubSpot
          </label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="pat-na1-..."
                className={cn(input, 'pr-9 font-mono')}
              />
              <button type="button" onClick={() => setShowToken((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                {showToken ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
              </button>
            </div>
            <button type="button" onClick={connect} disabled={busy}
              className="shrink-0 rounded-md bg-primary px-4 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-all disabled:opacity-50">
              {busy ? 'Verificando...' : 'Conectar y verificar'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ── Conectado ─────────────────────────────────────────────────────────────
  const isError = props.syncStatus === 'error'
  const realtime = !!props.lastWebhookAt

  return (
    <div className="space-y-6">
      {/* Estado */}
      <div className={cn(
        'rounded-xl border p-4 space-y-2',
        isError ? 'border-red-500/30 bg-red-500/5' : 'border-emerald-500/25 bg-emerald-500/5',
      )}>
        <div className="flex items-center gap-2">
          {isError
            ? <AlertTriangle className="h-4 w-4 text-red-400" />
            : <CheckCircle2 className="h-4 w-4 text-emerald-400" />}
          <p className={cn('text-sm font-bold', isError ? 'text-red-400' : 'text-emerald-400')}>
            {isError ? 'Tu conexión con HubSpot dejó de funcionar' : 'Conectado a HubSpot'}
            {!isError && props.hubDomain && <span className="font-normal text-muted-foreground"> · {props.hubDomain}</span>}
          </p>
        </div>
        {isError && props.lastError && <p className="text-xs text-red-300/80">{props.lastError}</p>}
        {!isError && (
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <Zap className={cn('h-3 w-3', realtime ? 'text-cyan-400' : 'text-muted-foreground/40')} />
              {realtime ? 'Sincroniza en tiempo real' : 'Solo respaldo diario — falta configurar los webhooks'}
            </span>
            {props.lastSyncAt && <span>Última sincronización: {new Date(props.lastSyncAt).toLocaleString('es-CO')}</span>}
          </div>
        )}
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={syncNow} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border bg-muted/20 px-3 py-1.5 text-xs text-foreground hover:bg-muted/40 transition-colors disabled:opacity-50">
            <RefreshCw className={cn('h-3 w-3', busy && 'animate-spin')} /> Sincronizar ahora
          </button>
          <button type="button" onClick={disconnect} disabled={busy}
            className="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:text-red-400 hover:border-red-400/30 transition-colors disabled:opacity-50">
            <Unplug className="h-3 w-3" /> Desconectar
          </button>
        </div>
      </div>

      {isError && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5 space-y-3">
          <p className="text-sm font-bold text-foreground">Genera un token nuevo y pégalo aquí</p>
          <Guide steps={HUBSPOT_SETUP_STEPS} />
        </div>
      )}

      {/* Mapeo de etapas */}
      {pipelines && pipelines.length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Asocia tus etapas de HubSpot
          </p>
          {pipelines.length > 1 && (
            <select value={pipelineId ?? ''} onChange={(e) => setPipelineId(e.target.value)} className={input}>
              {pipelines.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          )}
          <div className="space-y-1.5">
            {(pipelines.find((p) => p.id === pipelineId) ?? pipelines[0]).stages.map((st) => (
              <div key={st.id} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                <span className="flex-1 text-xs text-foreground truncate">
                  {st.label}
                  {st.isClosed && (
                    <span className={cn(
                      'ml-1.5 rounded px-1 py-0.5 text-[9px] font-bold uppercase',
                      st.probability >= 1 ? 'bg-emerald-400/10 text-emerald-400' : 'bg-red-400/10 text-red-400',
                    )}>
                      {st.probability >= 1 ? 'ganado' : 'perdido'}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground/40 text-xs">→</span>
                <select
                  value={stageMap[st.id] ?? ''}
                  onChange={(e) => setStageMap((m) => ({ ...m, [st.id]: e.target.value }))}
                  className="w-52 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/60"
                >
                  <option value="">— Sin asociar —</option>
                  {ppStages.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground/60">
            Ganado y perdido se detectan solos según cómo esté configurado tu pipeline en HubSpot.
          </p>
        </div>
      )}

      {/* Owners sin asociar */}
      {owners && owners.filter((o) => !o.mappedUserId).length > 0 && (
        <div className="space-y-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60">
            Propietarios sin asociar
          </p>
          <div className="space-y-1.5">
            {owners.filter((o) => !ownerMap[o.hubspotOwnerId]).map((o) => (
              <div key={o.hubspotOwnerId} className="flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                <span className="flex-1 text-xs text-foreground truncate">
                  {o.hubspotName ?? o.hubspotEmail ?? o.hubspotOwnerId}
                </span>
                <select
                  value={ownerMap[o.hubspotOwnerId] ?? ''}
                  onChange={(e) => setOwnerMap((m) => ({ ...m, [o.hubspotOwnerId]: e.target.value }))}
                  className="w-52 rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:outline-none focus:border-primary/60"
                >
                  <option value="">— Sin asignar —</option>
                  {candidates.map((c) => (
                    <option key={c.id} value={c.id}>{c.fullName ?? c.email}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tiempo real */}
      <div className="space-y-3 rounded-xl border border-border bg-muted/10 p-4">
        <p className="text-sm font-bold text-foreground">Sincronización en tiempo real (recomendado)</p>
        <p className="text-[11px] text-muted-foreground/70">
          Sin esto, los negocios se traen una vez al día. Con esto, aparecen al instante.
        </p>
        <Guide steps={HUBSPOT_WEBHOOK_STEPS} />
        <div className="space-y-1.5">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Client secret {props.hasClientSecret && <span className="text-emerald-400 normal-case">· ya guardado</span>}
          </label>
          <input
            type="password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            placeholder={props.hasClientSecret ? '•••••••• (deja vacío para no cambiarlo)' : 'Pega aquí el client secret'}
            className={cn(input, 'font-mono')}
          />
        </div>
        <div className="space-y-1.5">
          <label className="block text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            URL de destino para HubSpot
          </label>
          <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/20 px-3 py-2">
            <code className="flex-1 font-mono text-[11px] text-foreground break-all">{props.webhookUrl}</code>
            <CopyButton text={props.webhookUrl} />
          </div>
        </div>
      </div>

      <button type="button" onClick={saveMapping} disabled={busy}
        className="w-full rounded-lg bg-primary/15 border border-primary/30 py-2 text-sm font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-50">
        {busy ? 'Guardando...' : 'Guardar configuración'}
      </button>
    </div>
  )
}
