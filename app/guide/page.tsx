'use client'

import { useState } from 'react'
import { TrendingUp, ChevronDown, ArrowLeft, BookOpen, User, Users } from 'lucide-react'
import { cn } from '@/lib/utils'

/* ─── Types ─── */
type Tab = 'start' | 'seller' | 'manager'

interface Section {
  title: string
  icon: string
  steps: (string | { label: string; detail: string })[]
  tip?: string
}

/* ─── Content ─── */
const SECTIONS: Record<Tab, Section[]> = {
  start: [
    {
      icon: '👤',
      title: 'Paso 1 — Completa tu perfil',
      steps: [
        'Cuando te registras, tu acceso queda en revisión. El administrador lo activará antes de que puedas ingresar.',
        'Una vez activo, ingresa con tu email y contraseña o con Google.',
        'Al entrar por primera vez pasarás por el proceso de onboarding donde podrás configurar tu información básica.',
      ],
      tip: 'Si tu cuenta lleva más de 24h en revisión, contáctanos por WhatsApp.',
    },
    {
      icon: '🧪',
      title: 'Paso 2 — Crea tu Recetario comercial',
      steps: [
        { label: 'Ve a "Recetario" en el menú lateral.', detail: 'El recetario es tu plan de prospección: define cuántas actividades de cada tipo debes ejecutar para alcanzar tu cuota.' },
        'Crea un escenario con nombre (ej. "Q2 2026") y define las metas de actividad por período.',
        'Activa el escenario. Solo puede haber uno activo a la vez.',
        'El dashboard comparará tu ejecución real contra este plan en tiempo real.',
      ],
      tip: 'Piensa en el recetario como tu fórmula: si la sigues cada semana, la cuota se cumple.',
    },
    {
      icon: '📋',
      title: 'Paso 3 — Define tus Actividades',
      steps: [
        { label: 'Ve a "Actividades" en el menú lateral.', detail: 'Las actividades son los tipos de prospección que realizas: llamadas frías, DMs de LinkedIn, mensajes fríos, networking, referidos, leads de marketing, etc.' },
        'Crea cada actividad con nombre, canal, tipo (OUTBOUND / INBOUND) y metas diarias, semanales y mensuales.',
        'Solo las actividades en estado "Activo" se cuentan en tu dashboard y check-in.',
        'Puedes ajustar las metas cuando tu plan cambie, sin perder el historial.',
      ],
    },
    {
      icon: '✅',
      title: 'Paso 4 — Haz tu primer Check-in',
      steps: [
        'Ve a "Check-in Diario" en el menú lateral.',
        'Verás una tarjeta por cada actividad activa. Ingresa el número de veces que la ejecutaste hoy.',
        'El sistema calcula automáticamente tu cumplimiento del día.',
        'Guarda el check-in. Solo se registra un check-in por día — si vuelves a entrar, puedes editarlo.',
      ],
      tip: 'Dedica 2 minutos al final de tu jornada a hacer el check-in. Esa constancia es lo que hace funcionar el sistema.',
    },
    {
      icon: '📊',
      title: 'Paso 5 — Lee tu Dashboard',
      steps: [
        { label: 'El semáforo indica tu nivel de cumplimiento:', detail: '🟢 Verde = ≥ 90% · 🟡 Amarillo = 70–89% · 🔴 Rojo = < 70%' },
        'La "Proyección al cierre" te muestra si vas a cumplir la meta al ritmo actual.',
        'Cambia el período (diario / semanal / mensual / trimestral) con el selector superior.',
        'Las gráficas muestran tu tendencia acumulada vs la meta lineal del período.',
      ],
    },
  ],

  seller: [
    {
      icon: '☀️',
      title: 'Check-in diario — La rutina de 2 minutos',
      steps: [
        'Abre ProspectPro al final de tu jornada.',
        'Ve a "Check-in Diario" y registra cuántas veces ejecutaste cada actividad.',
        'No dejes pasar el día sin hacerlo — el sistema solo acepta un check-in por fecha.',
        'Si olvidaste un día, puedes registrarlo entrando al check-in y seleccionando la fecha correspondiente.',
      ],
      tip: 'El check-in constante es tu principal herramienta de control. Sin datos, no hay semáforo.',
    },
    {
      icon: '🎯',
      title: 'Dashboard — Entiende tu semáforo',
      steps: [
        { label: 'Cumplimiento:', detail: 'Porcentaje de actividades realizadas vs la meta del período seleccionado.' },
        { label: 'Desviación acumulada:', detail: 'Cuántas actividades te faltan o te sobran respecto a la meta. Un número negativo significa que vas atrasado.' },
        { label: 'Proyección al cierre:', detail: 'Al ritmo actual, ¿cuántas actividades habrás hecho al cerrar el período? Si es menor al 100%, necesitas acelerar.' },
        'Usa el selector de período para ver tu comportamiento diario, semanal, mensual o trimestral.',
      ],
    },
    {
      icon: '💼',
      title: 'Mi Pipeline — Registra y avanza tus negocios',
      steps: [
        'Ve a "Mi Pipeline" en el menú lateral.',
        'Crea una oportunidad con: nombre de empresa, contacto, valor estimado y etapa actual.',
        { label: 'Etapas del pipeline:', detail: 'Prospecto → Primer contacto → Reunión agendada → Propuesta enviada → Negociación → Ganado / Perdido' },
        'Avanza la etapa a medida que el negocio progresa.',
        'El sistema muestra el valor ponderado según la probabilidad de cierre de cada etapa.',
      ],
      tip: 'Mantén el pipeline actualizado. Es la foto más honesta de tu situación comercial.',
    },
    {
      icon: '🤖',
      title: 'Coach IA — Tu aliado semanal',
      steps: [
        'Cada semana el Coach IA genera un reporte con análisis de tu actividad y recomendaciones.',
        'Ve a "Reportes Coach IA" en el menú. El punto rojo indica que tienes mensajes sin leer.',
        { label: 'El reporte incluye:', detail: '✦ Resumen de tu semana · ✦ Comparativo contra tu meta · ✦ Análisis de tendencias · ✦ Acciones concretas para la próxima semana' },
        'Lee el reporte al inicio de cada semana y aplica las recomendaciones.',
      ],
    },
    {
      icon: '🧪',
      title: 'Recetario — Tu fórmula de prospección',
      steps: [
        'El Recetario define cuántas actividades de cada tipo debes hacer para alcanzar tu cuota.',
        'Ve a "Recetario" para ver el escenario activo y sus metas.',
        'El Dashboard compara tu ejecución real vs el recetario activo — esa es tu brecha.',
        'Si tu recetario cambia (nueva cuota, nuevo plan), crea un nuevo escenario y actívalo.',
      ],
      tip: 'No cambies el recetario a mitad de período salvo que el plan comercial cambie formalmente.',
    },
  ],

  manager: [
    {
      icon: '👥',
      title: 'Vista del equipo en tiempo real',
      steps: [
        'Ve a "Mi Equipo" en el menú lateral (visible solo para managers y admins).',
        'Verás todos los vendedores de tu equipo con su semáforo individual de cumplimiento.',
        'Haz clic en un vendedor para ver su detalle: actividades, dashboard y pipeline individual.',
        { label: 'El semáforo del equipo funciona igual que el individual:', detail: '🟢 ≥ 90% · 🟡 70–89% · 🔴 < 70%' },
      ],
      tip: 'Revisa el equipo cada lunes. Los semáforos rojos del viernes son señal de acción inmediata.',
    },
    {
      icon: '🧠',
      title: 'Gerente IA — Análisis inteligente del equipo',
      steps: [
        'Ve a "Gerente AI" en el menú lateral.',
        'Usa el filtro de vendedores para analizar uno específico o ver el equipo completo.',
        'Haz clic en "Generar análisis" para que el IA procese los datos actuales.',
        { label: 'El análisis se divide en 3 secciones:', detail: '🔵 SITUACIÓN: estado actual de la actividad del equipo · 🟣 PIPELINE: estado de los negocios en curso · 🟡 RECOMENDACIÓN: acciones prioritarias para el manager' },
        'Usa la pestaña "Proyecciones" para ver el forecast individual y el momentum score de cada vendedor.',
      ],
      tip: 'Genera el análisis antes de cada 1-a-1 o reunión de equipo. Llega con datos, no con intuición.',
    },
    {
      icon: '📈',
      title: 'Proyecciones y Momentum Score',
      steps: [
        { label: 'Forecast de cierre:', detail: 'Proyección de cuántas actividades hará cada vendedor al cerrar el período, basada en su ritmo actual.' },
        { label: 'Momentum Score:', detail: 'Indicador de si el vendedor va acelerando (↑) o desacelerando (↓) respecto a semanas anteriores. Un vendedor con buena actividad pero momentum negativo es señal temprana de riesgo.' },
        'Usa el scatter plot para identificar de un vistazo quién está en zona de riesgo vs zona de éxito.',
        'Las alertas rojas indican vendedores que necesitan intervención inmediata.',
      ],
    },
    {
      icon: '📬',
      title: 'Reportes automáticos semanales y mensuales',
      steps: [
        'ProspectPro genera reportes automáticos del equipo cada viernes (semanal) y al cierre de cada mes (mensual).',
        'Los reportes aparecen en "Reportes Coach IA" para cada vendedor — el manager también tiene acceso a ellos.',
        { label: 'El reporte semanal incluye:', detail: '✦ Cumplimiento del equipo · ✦ Actividad por vendedor · ✦ Alerta de vendedores en riesgo · ✦ Recomendaciones de gestión' },
        { label: 'El reporte mensual incluye:', detail: '✦ Cierre del período vs meta · ✦ Tendencia mensual del equipo · ✦ Proyección del siguiente mes · ✦ Análisis de pipeline y probabilidad de cierre' },
      ],
      tip: 'Los reportes son el insumo para tus reuniones de equipo y para reportar arriba. No hay que preparar nada — el sistema lo hace.',
    },
    {
      icon: '💼',
      title: 'Pipeline del equipo',
      steps: [
        'Desde "Mi Equipo", haz clic en cualquier vendedor para ver su pipeline detallado.',
        'Identifica negocios estancados: oportunidades que llevan demasiado tiempo en la misma etapa.',
        'El valor ponderado total del equipo te da la visibilidad de cuánto hay en juego en el pipeline actual.',
        'Usa esta información para decidir dónde enfocas el coaching individual.',
      ],
    },
  ],
}

const TABS: { id: Tab; label: string; icon: typeof BookOpen }[] = [
  { id: 'start',   label: 'Primeros pasos', icon: BookOpen },
  { id: 'seller',  label: 'Vendedor',       icon: User    },
  { id: 'manager', label: 'Manager',        icon: Users   },
]

/* ─── Accordion item ─── */
function AccordionItem({ section }: { section: Section }) {
  const [open, setOpen] = useState(false)

  return (
    <div className={cn(
      'rounded-xl border transition-all duration-200',
      open ? 'border-primary/30 bg-primary/5' : 'border-border bg-card hover:border-border/80'
    )}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="flex items-center gap-3">
          <span className="text-xl leading-none">{section.icon}</span>
          <span className="text-sm font-semibold text-foreground">{section.title}</span>
        </div>
        <ChevronDown className={cn(
          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200',
          open && 'rotate-180'
        )} />
      </button>

      {open && (
        <div className="px-5 pb-5 space-y-3">
          <div className="h-px bg-border/60" />
          <ol className="space-y-3">
            {section.steps.map((step, i) => (
              <li key={i} className="flex gap-3">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/15 text-[10px] font-bold text-primary">
                  {i + 1}
                </span>
                <div className="text-sm text-muted-foreground leading-relaxed">
                  {typeof step === 'string' ? (
                    step
                  ) : (
                    <>
                      <span className="font-medium text-foreground">{step.label}</span>
                      <br />
                      <span className="text-xs opacity-80">{step.detail}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ol>
          {section.tip && (
            <div className="flex gap-2.5 rounded-lg border border-primary/20 bg-primary/5 px-4 py-3">
              <span className="text-sm">💡</span>
              <p className="text-xs text-primary/90 leading-relaxed">{section.tip}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ─── Page ─── */
export default function GuidePage() {
  const [activeTab, setActiveTab] = useState<Tab>('start')

  return (
    <div className="min-h-full bg-background">
      {/* Header */}
      <header className="sticky top-0 z-10 border-b border-border bg-background/90 backdrop-blur-sm">
        <div className="mx-auto max-w-3xl px-4 py-3 flex items-center gap-4">
          <a
            href="/"
            className="flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Volver</span>
          </a>

          <div className="flex items-center gap-2 flex-1">
            <div className="relative flex h-7 w-7 items-center justify-center rounded-lg bg-primary">
              <TrendingUp className="h-4 w-4 text-primary-foreground" />
            </div>
            <span className="text-sm font-bold text-foreground">ProspectPro</span>
            <span className="text-muted-foreground/40">/</span>
            <span className="text-sm text-muted-foreground">Guía de uso</span>
          </div>

          <a
            href="/dashboard"
            className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary hover:bg-primary/20 transition-colors"
          >
            Ir a la app →
          </a>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8 space-y-8">
        {/* Hero */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-4 py-1.5 text-xs font-semibold text-primary">
            📖 Guía completa de uso
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">
            Empieza a prosperar con sistema
          </h1>
          <p className="text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            Todo lo que necesitas saber para sacarle el máximo provecho a ProspectPro — desde crear tu primer recetario hasta interpretar los reportes del equipo.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-xl border border-border bg-card p-1 gap-1">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-xs font-semibold transition-all',
                activeTab === id
                  ? 'bg-primary text-primary-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span>{label}</span>
            </button>
          ))}
        </div>

        {/* Tab description */}
        <div className="rounded-xl border border-border bg-card/50 px-5 py-4">
          {activeTab === 'start' && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Si acabas de registrarte, empieza aquí. Estos 5 pasos te dejan listo para usar ProspectPro y que los datos empiecen a fluir desde el día uno.
            </p>
          )}
          {activeTab === 'seller' && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Tu guía diaria como vendedor. Aquí está todo lo que necesitas para registrar tu actividad, entender tu semáforo, gestionar tu pipeline y aprovechar el feedback del Coach IA.
            </p>
          )}
          {activeTab === 'manager' && (
            <p className="text-sm text-muted-foreground leading-relaxed">
              Como manager tienes acceso a la vista del equipo en tiempo real, el Gerente IA para análisis inteligente, proyecciones individuales por vendedor, y reportes automáticos semanales y mensuales.
            </p>
          )}
        </div>

        {/* Sections */}
        <div className="space-y-3">
          {SECTIONS[activeTab].map((section, i) => (
            <AccordionItem key={i} section={section} />
          ))}
        </div>

        {/* Footer CTA */}
        <div className="rounded-xl border border-primary/20 bg-primary/5 p-6 text-center space-y-3">
          <p className="text-sm font-semibold text-foreground">¿Tienes dudas puntuales?</p>
          <p className="text-xs text-muted-foreground">
            Escríbenos por WhatsApp y te ayudamos en minutos.
          </p>
          <a
            href="https://wa.me/573164283749"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-[#25D366] px-5 py-2.5 text-sm font-bold text-white shadow-md hover:bg-[#20b858] transition-colors"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="white">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            Contactar soporte
          </a>
        </div>
      </div>
    </div>
  )
}
