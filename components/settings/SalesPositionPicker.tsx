'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { Phone, Trophy, Repeat } from 'lucide-react'
import { cn } from '@/lib/utils'
import { updateSalesPosition } from '@/lib/actions/profile'
import type { SalesPosition } from '@/lib/calculations/recipe'

interface Props {
  current: SalesPosition
}

const OPTIONS: {
  value: Exclude<SalesPosition, null>
  icon: typeof Phone
  title: string
  desc: string
}[] = [
  {
    value: 'bdr_sdr',
    icon: Phone,
    title: 'BDR / SDR',
    desc: 'Prospecto y agendo reuniones. No ejecuto la reunión ni cierro.',
  },
  {
    value: 'closer',
    icon: Trophy,
    title: 'Closer',
    desc: 'Ejecuto la reunión y cierro. Las reuniones me llegan agendadas.',
  },
  {
    value: 'full_cycle',
    icon: Repeat,
    title: 'Ciclo completo',
    desc: 'Prospecto, agendo, ejecuto la reunión y cierro — todo el embudo.',
  },
]

export function SalesPositionPicker({ current }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<SalesPosition>(current)
  const [saving, setSaving] = useState(false)

  async function handleSelect(value: Exclude<SalesPosition, null>) {
    if (value === selected || saving) return
    setSaving(true)
    try {
      await updateSalesPosition(value)
      setSelected(value)
      toast.success('Cargo actualizado ✓')
      router.refresh()
    } catch {
      toast.error('No se pudo actualizar el cargo')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-sm font-semibold text-foreground">Tu cargo comercial</p>
        <p className="text-xs text-muted-foreground mt-0.5">
          El Recetario usa esto para mostrarte solo la meta que te corresponde, en vez del embudo completo.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-3">
        {OPTIONS.map(({ value, icon: Icon, title, desc }) => (
          <button
            key={value}
            type="button"
            disabled={saving}
            onClick={() => handleSelect(value)}
            className={cn(
              'flex flex-col items-start gap-1.5 rounded-lg border p-3 text-left transition-colors disabled:opacity-50',
              selected === value
                ? 'border-primary/50 bg-primary/10'
                : 'border-border bg-card hover:border-primary/30 hover:bg-muted/20',
            )}
          >
            <Icon className={cn('h-4 w-4', selected === value ? 'text-primary' : 'text-muted-foreground')} />
            <p className={cn('text-xs font-semibold', selected === value ? 'text-primary' : 'text-foreground')}>
              {title}
            </p>
            <p className="text-[11px] text-muted-foreground leading-snug">{desc}</p>
          </button>
        ))}
      </div>
      {!selected && (
        <p className="text-[11px] text-muted-foreground/60">
          Sin cargo elegido, el Recetario se ve igual que siempre (embudo completo).
        </p>
      )}
    </div>
  )
}
