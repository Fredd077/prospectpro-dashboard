/**
 * Cálculo de métricas de equipo compartido entre el motor de reportes del
 * Coach IA (intelligence-engine.ts) y el reporte por correo (team-report.ts).
 * Antes cada uno tenía su propia versión de cumplimiento y desconocía las
 * etapas reales del pipeline — vivían aquí para que un mismo vendedor no
 * muestre dos números distintos según qué reporte se mire.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'
import { _fetchActivityEffectiveness, type ActivityEffectivenessItem } from '@/lib/utils/coach-context'

type SbClient = SupabaseClient<Database>

/**
 * Cumplimiento como PROMEDIO DE RATIOS TOPADOS: cada actividad aporta su ratio
 * limitado al 100% y todas pesan igual. Es la misma fórmula que usan el
 * Dashboard y /team, para que un mismo vendedor no muestre dos porcentajes
 * distintos según dónde se le mire. El tope evita que pasarse en una actividad
 * compense haber abandonado otra.
 */
export function cappedCompliance(items: { goal: number; real: number }[]): number {
  let sum = 0, n = 0
  for (const a of items) {
    if (a.goal <= 0) continue
    sum += Math.min(a.real, a.goal) / a.goal
    n++
  }
  return n > 0 ? Math.round((sum / n) * 100) : 0
}

/**
 * Estado del pipeline del equipo por etapa: cuántos negocios y cuánto dinero.
 *
 * Agrupa por el nombre de etapa que TRAEN los propios registros de
 * pipeline_simple, no por recipe_scenarios.funnel_stages: se verificó que esas
 * dos listas no coinciden en ningún usuario, así que usar el Recetario daría
 * todas las etapas en cero.
 */
export interface EtapaPipeline {
  etapa: string
  negocios: number
  monto: number
  abiertos: number
  ganados: number
  perdidos: number
}

export function buildStageBreakdown(
  rows: { stage: string; status: string; amount_usd: number | null }[],
): EtapaPipeline[] {
  const agg: Record<string, EtapaPipeline> = {}
  for (const r of rows) {
    const cur = agg[r.stage] ?? { etapa: r.stage, negocios: 0, monto: 0, abiertos: 0, ganados: 0, perdidos: 0 }
    cur.negocios += 1
    cur.monto += r.amount_usd ?? 0
    // Cierre ganado = etapa 'Por facturar/cobrar' Y estado 'ganado' (ambas). Un
    // 'ganado' en otra etapa es estado de flujo (auto-marcado al avanzar hacia
    // Cierre), no un cierre real — ver lib/utils/gerente-pipeline.ts.
    if (r.status === 'ganado' && r.stage === 'Por facturar/cobrar') cur.ganados += 1
    else if (r.status === 'perdido') cur.perdidos += 1
    else cur.abiertos += 1
    agg[r.stage] = cur
  }
  return Object.values(agg).sort((a, b) => b.negocios - a.negocios)
}

/** Efectividad por canal agregada del equipo (suma por nombre de actividad entre miembros). */
export async function fetchTeamChannels(
  sb: SbClient,
  memberIds: string[],
  start: string,
  end: string,
): Promise<ActivityEffectivenessItem[]> {
  const perMember = await Promise.all(
    memberIds.map((id) => _fetchActivityEffectiveness(sb, start, end, id)),
  )
  const agg: Record<string, { type: 'OUTBOUND' | 'INBOUND'; exec: number; meet: number; close: number }> = {}
  for (const list of perMember) {
    for (const e of list) {
      const cur = agg[e.name] ?? { type: e.type, exec: 0, meet: 0, close: 0 }
      cur.exec += e.executions
      cur.meet += e.estimatedMeetings
      cur.close += e.estimatedCloses
      agg[e.name] = cur
    }
  }
  return Object.entries(agg)
    .map(([name, v]) => ({
      name, type: v.type, executions: v.exec, estimatedMeetings: v.meet, estimatedCloses: v.close,
      conversionToMeeting: v.exec > 0 ? Math.round((v.meet / v.exec) * 100) : 0,
      closeProbability: v.meet > 0 ? Math.round((v.close / v.meet) * 100) : 0,
    }))
    .filter((i) => i.executions > 0)
    .sort((a, b) => b.conversionToMeeting - a.conversionToMeeting)
}

/**
 * Tasa de conversión PLANEADA vs REAL por actividad, a nivel de equipo.
 *
 * Es la pregunta del Recetario → Rendimiento: "definí que las llamadas en frío
 * convierten 20%, ¿de verdad convierten 20%?". El plan sale de
 * activities.conversion_rate_pct; la real, de dividir citas generadas entre
 * ejecuciones (lo que ya calcula fetchTeamChannels sobre pipeline_simple). La
 * brecha es lo que dice si hay que ajustar el plan.
 *
 * NO usa recipe_scenarios.funnel_stages: esa lista quedó desalineada de las
 * etapas reales del Pipeline y no interviene aquí.
 */
export interface ConversionActividad {
  actividad: string
  tipo: 'OUTBOUND' | 'INBOUND'
  ejecuciones: number
  citas_generadas: number
  conversion_real: number
  conversion_plan: number
  /** real − plan, en puntos porcentuales. Negativo = por debajo de lo planeado. */
  brecha: number
}

export async function fetchTeamConversions(
  sb: SbClient,
  memberIds: string[],
  effectiveness: ActivityEffectivenessItem[],
): Promise<ConversionActividad[]> {
  const { data: acts } = await sb
    .from('activities')
    .select('name,type,conversion_rate_pct')
    .in('user_id', memberIds)
    .eq('status', 'active')

  // Plan por nombre de actividad: promedio entre miembros que la tengan configurada.
  const planAgg: Record<string, { sum: number; n: number }> = {}
  for (const a of acts ?? []) {
    const rate = a.conversion_rate_pct ?? 0
    if (rate <= 0) continue
    const cur = planAgg[a.name] ?? { sum: 0, n: 0 }
    cur.sum += rate; cur.n += 1
    planAgg[a.name] = cur
  }

  return effectiveness
    .filter((e) => e.executions > 0)
    .map((e) => {
      const plan = planAgg[e.name] ? Math.round(planAgg[e.name].sum / planAgg[e.name].n) : 0
      return {
        actividad:       e.name,
        tipo:            e.type,
        ejecuciones:     e.executions,
        citas_generadas: e.estimatedMeetings,
        conversion_real: e.conversionToMeeting,
        conversion_plan: plan,
        brecha:          plan > 0 ? e.conversionToMeeting - plan : 0,
      }
    })
    .sort((a, b) => a.brecha - b.brecha) // las más por debajo del plan, primero
}
