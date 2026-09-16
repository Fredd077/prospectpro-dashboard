import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

interface UnassignedStageAlertProps {
  /** Nombres de etapa (texto real, tal cual están en pipeline_simple) que
   * tienen al menos un negocio registrado pero ningún role asignado — no se
   * cuentan en Rendimiento, Dashboard ni reportes hasta que se configuren. */
  stageNames: string[]
}

/**
 * Red de seguridad para el hueco que no se puede prevenir del todo al crear
 * una etapa (ver sugerencia automática en PipelineStagesManager): si por
 * cualquier razón una etapa con negocios reales se queda sin role — se borró
 * el que tenía, se creó por API/integración, etc. — esto lo avisa aquí mismo,
 * donde el usuario vería el número en cero, en vez de dejarlo para que lo
 * note por sí solo o para que soporte tenga que revisarlo cuenta por cuenta.
 */
export function UnassignedStageAlert({ stageNames }: UnassignedStageAlertProps) {
  if (stageNames.length === 0) return null

  const label = stageNames.length === 1
    ? `La etapa "${stageNames[0]}" tiene`
    : `Las etapas ${stageNames.map((s) => `"${s}"`).join(', ')} tienen`

  return (
    <div className="flex items-center gap-3 rounded-lg border border-amber-400/30 bg-amber-400/5 px-4 py-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-amber-400" />
      <p className="flex-1 text-sm text-amber-200">
        {label} negocios registrados, pero no le has dicho a ProspectPro qué representan —
        no se cuentan en Rendimiento ni en tus reportes hasta que las configures.
      </p>
      <Link
        href="/pipeline"
        className="shrink-0 rounded-md border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition-colors hover:bg-amber-400/20"
      >
        Configurar →
      </Link>
    </div>
  )
}
