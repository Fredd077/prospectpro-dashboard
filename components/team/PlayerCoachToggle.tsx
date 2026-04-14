'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { togglePlayerCoach } from '@/lib/actions/team'

export function PlayerCoachToggle({ initialValue }: { initialValue: boolean }) {
  const [checked, setChecked] = useState(initialValue)
  const [isPending, startTransition] = useTransition()
  const router = useRouter()

  function handleToggle() {
    const current = checked
    setChecked(!current)
    startTransition(async () => {
      await togglePlayerCoach(current)
      router.refresh()
    })
  }

  return (
    <div className="flex items-center gap-3 rounded-lg border border-border bg-card px-5 py-3 w-fit">
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={handleToggle}
        disabled={isPending}
        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
          checked ? 'bg-[#00D9FF]' : 'bg-muted'
        }`}
      >
        <span
          className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
      <div>
        <p className="text-sm font-semibold text-foreground">
          Incluir mis métricas en los reportes del equipo
        </p>
        <p className="text-xs font-semibold" style={{ color: '#39FF14' }}>
          Actívalo si también tienes actividades de venta asignadas
        </p>
      </div>
    </div>
  )
}
