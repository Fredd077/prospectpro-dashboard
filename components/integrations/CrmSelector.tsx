'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'
import { selectCrm } from '@/lib/actions/integrations'
import { CRM_CATALOG, CrmLogo, matchCrm, type CrmDef } from './crm-catalog'

interface Props {
  /** integrations.crm_name actual, si ya se eligió uno. */
  current: string | null
}

/**
 * Cuadrícula de selección de CRM. HubSpot abre el flujo nativo; cualquier otro
 * (incluido "Otro CRM") lleva al flujo genérico por webhook que ya existía, sin
 * cambiarle la lógica: lo único distinto es cómo se llega.
 */
export function CrmSelector({ current }: Props) {
  const router = useRouter()
  const [pending, startTransition] = useTransition()
  const [otherOpen, setOtherOpen] = useState(false)
  const [otherName, setOtherName] = useState('')

  // Reconoce valores guardados por el input de texto libre anterior
  // ('pipedrive', 'HubSpot ', etc.) para que su tarjeta salga ya seleccionada.
  const matched = matchCrm(current)
  const isOther = !!current && !matched

  function choose(name: string) {
    startTransition(async () => {
      try {
        await selectCrm(name)
        toast.success(`CRM seleccionado: ${name}`)
        router.refresh()
      } catch (e) {
        toast.error(e instanceof Error ? e.message : 'No se pudo guardar la selección')
      }
    })
  }

  function Card({ crm, selected }: { crm: CrmDef; selected: boolean }) {
    return (
      <button
        type="button"
        onClick={() => choose(crm.id)}
        disabled={pending}
        className={cn(
          'relative flex flex-col items-center justify-center gap-2.5 rounded-xl border p-4 transition-all disabled:opacity-50',
          selected
            ? 'border-primary/50 bg-primary/5 shadow-[0_0_16px_rgba(0,217,255,0.12)]'
            : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20',
        )}
      >
        {selected && (
          <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
            <Check className="h-2.5 w-2.5 text-primary-foreground" />
          </span>
        )}
        <CrmLogo crm={crm} />
        <span className="text-xs font-medium text-foreground text-center leading-tight">{crm.label}</span>
        {crm.native && (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
            Nativo
          </span>
        )}
      </button>
    )
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {CRM_CATALOG.map((crm) => (
          <Card key={crm.id} crm={crm} selected={matched?.id === crm.id} />
        ))}

        {/* Otro CRM — sin logo de marca, ícono neutro */}
        <button
          type="button"
          onClick={() => setOtherOpen((v) => !v)}
          disabled={pending}
          className={cn(
            'relative flex flex-col items-center justify-center gap-2.5 rounded-xl border p-4 transition-all disabled:opacity-50',
            isOther
              ? 'border-primary/50 bg-primary/5'
              : 'border-dashed border-border bg-card hover:border-primary/30 hover:bg-muted/20',
          )}
        >
          {isOther && (
            <span className="absolute right-2 top-2 flex h-4 w-4 items-center justify-center rounded-full bg-primary">
              <Check className="h-2.5 w-2.5 text-primary-foreground" />
            </span>
          )}
          <CrmLogo crm={null} />
          <span className="text-xs font-medium text-foreground text-center leading-tight">
            {isOther ? current : 'Otro CRM'}
          </span>
        </button>
      </div>

      {otherOpen && (
        <div className="flex gap-2 rounded-lg border border-border bg-muted/10 p-3">
          <input
            type="text"
            value={otherName}
            onChange={(e) => setOtherName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && otherName.trim()) choose(otherName.trim()) }}
            placeholder="Nombre de tu CRM..."
            className="flex-1 rounded-md border border-border bg-background px-2.5 py-1.5 text-sm text-foreground placeholder:text-muted-foreground/40 focus:outline-none focus:border-primary/60"
          />
          <button
            type="button"
            onClick={() => otherName.trim() && choose(otherName.trim())}
            disabled={pending || !otherName.trim()}
            className="shrink-0 rounded-md bg-primary/15 border border-primary/30 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/25 transition-colors disabled:opacity-40"
          >
            Usar este
          </button>
        </div>
      )}
    </div>
  )
}
