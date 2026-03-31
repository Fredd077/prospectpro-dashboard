'use client'

import { useState } from 'react'
import { FlaskConical, ClipboardList, LayoutDashboard, ArrowRight } from 'lucide-react'

interface StepWelcomeProps {
  userName: string | null
  onNext: (company: string) => void
}

const concepts = [
  {
    icon: FlaskConical,
    title: 'Recetario',
    desc: 'Define cuántas actividades necesitas para alcanzar tu meta de ventas. Tu "receta" de éxito.',
    color: 'text-primary',
    bg: 'bg-primary/10',
  },
  {
    icon: ClipboardList,
    title: 'Actividades',
    desc: 'Configura tus actividades comerciales (llamadas, emails, LinkedIn) con metas mensuales.',
    color: 'text-warning',
    bg: 'bg-warning/10',
  },
  {
    icon: LayoutDashboard,
    title: 'Check-in Diario',
    desc: 'Registra lo que hiciste cada día. El dashboard muestra tu cumplimiento en tiempo real.',
    color: 'text-success',
    bg: 'bg-success/10',
  },
]

export function StepWelcome({ userName, onNext }: StepWelcomeProps) {
  const firstName = userName?.split(' ')[0] ?? 'Comercial'
  const [company, setCompany] = useState('')

  return (
    <div className="rounded-xl border border-border bg-card p-8 space-y-6">
      <div className="text-center space-y-2">
        <h1 className="text-2xl font-bold text-foreground">
          Hola {firstName}, bienvenido a ProspectPro
        </h1>
        <p className="text-sm text-muted-foreground">
          Configura tu espacio en 3 minutos. Así funciona:
        </p>
      </div>

      <div className="space-y-3">
        {concepts.map(({ icon: Icon, title, desc, color, bg }) => (
          <div
            key={title}
            className="flex items-start gap-4 rounded-lg border border-border bg-muted/20 p-4"
          >
            <div className={`shrink-0 rounded-md p-2 ${bg}`}>
              <Icon className={`h-5 w-5 ${color}`} />
            </div>
            <div className="space-y-0.5">
              <p className="text-sm font-semibold text-foreground">{title}</p>
              <p className="text-xs text-muted-foreground leading-relaxed">{desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Company field */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          ¿En qué empresa trabajas? <span className="text-muted-foreground/60">(opcional)</span>
        </label>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          placeholder="Nombre de tu empresa o organización..."
          className="w-full rounded-md border border-border bg-muted/30 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground/50 outline-none focus:border-primary/50 focus:ring-1 focus:ring-primary/20 transition-colors"
        />
      </div>

      <button
        onClick={() => onNext(company.trim())}
        className="w-full flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:opacity-90 hover:shadow-[0_0_20px_rgba(0,217,255,0.25)] transition-all"
      >
        Empezar configuración
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}
