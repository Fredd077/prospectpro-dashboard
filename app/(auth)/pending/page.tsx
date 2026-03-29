import type { Metadata } from 'next'
import Link from 'next/link'
import { Clock, TrendingUp, ArrowRight } from 'lucide-react'

export const metadata: Metadata = { title: 'Cuenta pendiente — ProspectPro' }

export default function PendingPage() {
  return (
    <div className="w-full max-w-md space-y-6 text-center">
      {/* Brand */}
      <div className="flex justify-center">
        <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
          <TrendingUp className="h-6 w-6 text-primary-foreground" />
        </div>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-warning/20 bg-card p-8 space-y-5 shadow-[0_0_40px_rgba(245,158,11,0.06)]">
        <div className="flex justify-center">
          <div className="rounded-full bg-warning/10 p-4">
            <Clock className="h-10 w-10 text-warning" />
          </div>
        </div>

        <div className="space-y-2">
          <h1 className="text-xl font-bold text-foreground">Cuenta pendiente de activación</h1>
          <p className="text-sm text-muted-foreground max-w-sm mx-auto leading-relaxed">
            Tu cuenta fue creada exitosamente. El administrador revisará tu solicitud y recibirás
            un email cuando tu acceso esté activado.
          </p>
        </div>

        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
          Tiempo estimado de revisión: <span className="text-foreground font-medium">24–48 horas</span>
        </div>

        <Link
          href="/login"
          className="flex items-center justify-center gap-2 text-sm text-primary hover:underline font-medium"
        >
          ← Volver al inicio de sesión
        </Link>
      </div>
    </div>
  )
}
