import type { Metadata } from 'next'
import { TrendingUp } from 'lucide-react'
import { GoogleButton } from '@/components/auth/GoogleButton'
import { LoginForm } from '@/components/auth/LoginForm'

export const metadata: Metadata = { title: 'Iniciar sesión — ProspectPro' }

interface Props {
  searchParams: Promise<{ error?: string }>
}

export default async function LoginPage({ searchParams }: Props) {
  const { error } = await searchParams

  return (
    <div className="w-full max-w-sm space-y-6">
      {/* Brand */}
      <div className="text-center space-y-3">
        <div className="flex justify-center">
          <div className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-primary">
            <TrendingUp className="h-6 w-6 text-primary-foreground" />
            <span className="pulse-dot absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background" />
          </div>
        </div>
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">ProspectPro</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Tu Command Center comercial</p>
        </div>
      </div>

      {/* Card */}
      <div className="rounded-xl border border-border bg-card p-6 space-y-5 shadow-[0_0_40px_rgba(0,217,255,0.04)]">
        <GoogleButton label="Continuar con Google" />

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground/60 uppercase tracking-wider">o</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <LoginForm errorParam={error} />
      </div>
    </div>
  )
}
