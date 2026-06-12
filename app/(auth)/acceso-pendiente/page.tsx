'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, Clock, LogOut, TrendingUp } from 'lucide-react'
import { getSupabaseBrowserClient } from '@/lib/supabase/client'

export default function AccesoPendientePage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    const sb = getSupabaseBrowserClient()
    await sb.auth.signOut()
    router.push('/login')
  }

  return (
    <div className="w-full max-w-md space-y-8 text-center">

      {/* Brand mark */}
      <div className="flex justify-center">
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-2xl"
          style={{
            background: 'linear-gradient(135deg, #0d1a1f 0%, #0a2530 100%)',
            border: '1px solid rgba(0,217,255,0.25)',
            boxShadow: '0 0 32px rgba(0,217,255,0.12), inset 0 1px 0 rgba(0,217,255,0.08)',
          }}
        >
          <TrendingUp className="h-7 w-7" style={{ color: '#00D9FF' }} />
          <span
            className="absolute -top-1 -right-1 h-3 w-3 rounded-full"
            style={{ background: '#f59e0b', boxShadow: '0 0 8px #f59e0b' }}
          />
        </div>
      </div>

      {/* Main card */}
      <div
        className="rounded-2xl p-8 space-y-6"
        style={{
          background: 'linear-gradient(180deg, #0d1117 0%, #0a0d12 100%)',
          border: '1px solid rgba(0,217,255,0.12)',
          boxShadow: '0 0 60px rgba(0,217,255,0.05), 0 24px 48px rgba(0,0,0,0.6)',
        }}
      >
        {/* Status badge */}
        <div className="flex justify-center">
          <div
            className="flex items-center gap-2 rounded-full px-4 py-2"
            style={{
              background: 'rgba(245,158,11,0.08)',
              border: '1px solid rgba(245,158,11,0.25)',
            }}
          >
            <Clock className="h-4 w-4" style={{ color: '#f59e0b' }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: '#f59e0b' }}>
              Acceso pendiente
            </span>
          </div>
        </div>

        {/* Headline */}
        <div className="space-y-3">
          <h1
            className="text-2xl font-black tracking-tight"
            style={{ color: '#ffffff' }}
          >
            Tu solicitud fue recibida
          </h1>
          <p className="text-sm leading-relaxed" style={{ color: 'rgba(255,255,255,0.45)' }}>
            Tu cuenta está pendiente de aprobación por el administrador.
            Recibirás un correo en cuanto tu acceso sea habilitado.
          </p>
        </div>

        {/* Info block */}
        <div
          className="rounded-xl px-5 py-4 text-left space-y-3"
          style={{
            background: 'rgba(0,217,255,0.04)',
            border: '1px solid rgba(0,217,255,0.08)',
          }}
        >
          {[
            { icon: ShieldCheck, text: 'Revisión manual por el administrador de la plataforma' },
            { icon: Clock,       text: 'Tiempo estimado: 24–48 horas hábiles' },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-start gap-3">
              <Icon className="h-4 w-4 mt-0.5 shrink-0" style={{ color: 'rgba(0,217,255,0.5)' }} />
              <p className="text-xs leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
                {text}
              </p>
            </div>
          ))}
        </div>

        {/* Sign-out — only exit */}
        <button
          onClick={handleSignOut}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 rounded-xl py-3 text-sm font-semibold transition-all disabled:opacity-50"
          style={{
            background: 'rgba(239,68,68,0.08)',
            border: '1px solid rgba(239,68,68,0.2)',
            color: 'rgba(239,68,68,0.8)',
          }}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.14)'
            ;(e.currentTarget as HTMLButtonElement).style.color = '#ef4444'
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'rgba(239,68,68,0.08)'
            ;(e.currentTarget as HTMLButtonElement).style.color = 'rgba(239,68,68,0.8)'
          }}
        >
          {loading
            ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-red-400/30 border-t-red-400" />
            : <LogOut className="h-4 w-4" />
          }
          {loading ? 'Cerrando sesión…' : 'Cerrar sesión'}
        </button>
      </div>

      {/* Footer note */}
      <p className="text-xs" style={{ color: 'rgba(255,255,255,0.2)' }}>
        ProspectPro · Acceso restringido hasta aprobación
      </p>
    </div>
  )
}
