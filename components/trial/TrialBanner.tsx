'use client'

import { useState } from 'react'
import { AlertTriangle, Clock, X } from 'lucide-react'

interface TrialBannerClientProps {
  daysLeft: number | null
  expired: boolean
}

export function TrialBannerClient({ daysLeft, expired }: TrialBannerClientProps) {
  const [dismissed, setDismissed] = useState(false)
  if (dismissed) return null

  if (expired) {
    return (
      <div className="relative flex items-center gap-3 border-b border-red-500/30 bg-red-500/8 px-6 py-2.5 pr-10">
        <AlertTriangle className="h-4 w-4 shrink-0 text-red-400" />
        <p className="text-sm text-red-300 font-medium">
          Tu período de prueba ha expirado.{' '}
          <span className="text-red-400 font-semibold">Solo puedes ver tus datos.</span>{' '}
          Contacta a tu administrador para activar tu cuenta.
        </p>
        <button
          onClick={() => setDismissed(true)}
          className="absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 text-red-400/50 hover:text-red-400 hover:bg-red-400/10 transition-colors"
          title="Cerrar"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    )
  }

  const urgency = daysLeft !== null && daysLeft <= 1
    ? { bg: 'bg-orange-500/8 border-orange-500/30', text: 'text-orange-300', icon: 'text-orange-400', close: 'text-orange-400/50 hover:text-orange-400 hover:bg-orange-400/10', label: daysLeft === 0 ? 'vence hoy' : 'queda 1 día' }
    : daysLeft !== null && daysLeft <= 3
    ? { bg: 'bg-amber-500/8 border-amber-500/30', text: 'text-amber-300', icon: 'text-amber-400', close: 'text-amber-400/50 hover:text-amber-400 hover:bg-amber-400/10', label: `quedan ${daysLeft} días` }
    : { bg: 'bg-blue-500/8 border-blue-500/30', text: 'text-blue-300', icon: 'text-blue-400', close: 'text-blue-400/50 hover:text-blue-400 hover:bg-blue-400/10', label: `quedan ${daysLeft} días` }

  return (
    <div className={`relative flex items-center gap-3 border-b px-6 py-2 pr-10 ${urgency.bg}`}>
      <Clock className={`h-3.5 w-3.5 shrink-0 ${urgency.icon}`} />
      <p className={`text-xs font-medium ${urgency.text}`}>
        Período de prueba gratuita —{' '}
        <span className="font-semibold">{urgency.label}</span>.{' '}
        Contacta a tu administrador para activar tu cuenta.
      </p>
      <button
        onClick={() => setDismissed(true)}
        className={`absolute right-3 top-1/2 -translate-y-1/2 rounded p-1 transition-colors ${urgency.close}`}
        title="Cerrar"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
