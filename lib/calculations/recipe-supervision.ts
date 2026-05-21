// Pure calculation functions for the recipe supervision panel.
// No Supabase calls — all inputs are plain numbers/arrays.

export function calcCierresRequeridos(metaMensual: number, ticketPromedio: number): number {
  if (ticketPromedio <= 0) return 0
  return Math.round((metaMensual / ticketPromedio) * 100) / 100
}

export function calcCitasRequeridas(cierresReq: number, tasaCierrePct: number): number {
  const safe = tasaCierrePct > 0 ? tasaCierrePct : 0.0001
  return Math.round((cierresReq / (safe / 100)) * 100) / 100
}

export function calcCitasProyectadasPorActividad(params: {
  citasReqGrupo: number
  pesoPct: number
  conversionRatePct: number
}): { citasAsignadas: number; actividadesNecesarias: number } {
  const { citasReqGrupo, pesoPct, conversionRatePct } = params
  const citasAsignadas = Math.round((citasReqGrupo * (pesoPct / 100)) * 100) / 100
  const actividadesNecesarias =
    conversionRatePct > 0
      ? Math.round((citasAsignadas / (conversionRatePct / 100)) * 100) / 100
      : 0
  return { citasAsignadas, actividadesNecesarias }
}

export function calcIngresoProy(
  citasProyTotal: number,
  tasaCierrePct: number,
  ticketPromedio: number,
): number {
  return Math.round(citasProyTotal * (tasaCierrePct / 100) * ticketPromedio * 100) / 100
}

export function calcDesviacion(
  ingresoProy: number,
  metaMensual: number,
): { pct: number; valor: number; estado: 'ok' | 'warn' | 'danger' } {
  const safe = metaMensual > 0 ? metaMensual : 0.0001
  const pct   = Math.round(((ingresoProy - safe) / safe) * 1000) / 10
  const valor = ingresoProy - metaMensual
  const estado: 'ok' | 'warn' | 'danger' = pct >= -5 ? 'ok' : pct >= -25 ? 'warn' : 'danger'
  return { pct, valor, estado }
}

export function calcEficienciaActividad(
  convIndividual: number,
  promedioPonderado: number,
): 'alta' | 'media' | 'baja' {
  if (promedioPonderado <= 0) return 'media'
  const ratio = convIndividual / promedioPonderado
  if (ratio >= 0.9) return 'alta'
  if (ratio >= 0.7) return 'media'
  return 'baja'
}
