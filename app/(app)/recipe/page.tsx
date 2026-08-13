import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, FlaskConical } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { ScenarioCard } from '@/components/recipe/ScenarioCard'
import { AIRecipeBuilder } from '@/components/recipe/AIRecipeBuilder'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import {
  calcRecipe,
  DEFAULT_FUNNEL_STAGES,
  DEFAULT_OUTBOUND_RATES,
  DEFAULT_INBOUND_RATES,
} from '@/lib/calculations/recipe'

export const metadata: Metadata = {
  title: 'Recetario',
  description: 'Calcula y gestiona tus escenarios de funnel comercial',
}

export default async function RecipePage() {
  const sb = await getSupabaseServerClient()
  const { data: scenarios } = await sb
    .from('recipe_scenarios')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  const hasScenarios = scenarios && scenarios.length > 0

  // ── Brecha: metas configuradas vs. lo que exige el escenario activo ────────
  // Con el modelo nuevo cada actividad se dimensiona sola (meetings_expected /
  // conversion_rate_pct), así que la suma de metas ya no cuadra por construcción
  // con el total del escenario. Se avisa de forma suave, sin bloquear.
  const activeScenario = scenarios?.find((s) => s.is_active) ?? null
  let goalGap: { configured: number; required: number; unconfigured: number } | null = null

  if (activeScenario) {
    const { data: acts } = await sb
      .from('activities')
      .select('monthly_goal,meetings_expected,conversion_rate_pct')
      .eq('status', 'active')

    const rows = acts ?? []
    const configured = rows
      .filter((a) => (a.meetings_expected ?? 0) > 0 && (a.conversion_rate_pct ?? 0) > 0)
      .reduce((s, a) => s + (a.monthly_goal ?? 0), 0)
    const unconfigured = rows.filter(
      (a) => (a.meetings_expected ?? 0) <= 0 || (a.conversion_rate_pct ?? 0) <= 0,
    ).length

    const recipe = calcRecipe({
      monthly_revenue_goal:   activeScenario.monthly_revenue_goal,
      average_ticket:         activeScenario.average_ticket,
      outbound_pct:           activeScenario.outbound_pct,
      working_days_per_month: activeScenario.working_days_per_month ?? 20,
      funnel_stages:  activeScenario.funnel_stages  ?? DEFAULT_FUNNEL_STAGES,
      outbound_rates: activeScenario.outbound_rates ?? DEFAULT_OUTBOUND_RATES,
      inbound_rates:  activeScenario.inbound_rates  ?? DEFAULT_INBOUND_RATES,
    })
    const required = recipe.activities_needed_monthly

    if (required > 0 && configured < required) {
      goalGap = { configured, required, unconfigured }
    }
  }

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Recetario Comercial"
        description="Simula tu embudo de conversión y compara plan vs resultados reales"
        action={
          <Link href="/recipe/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="h-4 w-4 mr-1.5" />
            Nuevo escenario
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        {/* AI Recipe Builder */}
        <div className="mb-8">
          <p className="text-xs font-semibold uppercase tracking-widest text-cyan-400 mb-3">
            Crear con IA
          </p>
          <AIRecipeBuilder />
        </div>

        {!hasScenarios ? (
          <div className="flex flex-col items-center justify-center h-72 gap-5 rounded-lg border border-dashed border-border bg-card">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted">
              <FlaskConical className="h-7 w-7 text-muted-foreground" />
            </div>
            <div className="text-center space-y-1">
              <p className="font-semibold text-foreground">Aún no tienes escenarios</p>
              <p className="text-sm text-muted-foreground max-w-xs">
                Crea tu primer escenario para simular cuántas actividades necesitas para alcanzar tu meta comercial.
              </p>
            </div>
            <Link href="/recipe/new" className={buttonVariants()}>
              <Plus className="h-4 w-4 mr-1.5" />
              Crear primer escenario
            </Link>
          </div>
        ) : (
          <div>
            {/* Active scenario highlighted section */}
            {goalGap && (
              <div className="mb-6 rounded-lg border border-amber-500/25 bg-amber-500/5 px-4 py-3">
                <p className="text-xs text-amber-300/90 leading-relaxed">
                  Tus actividades configuradas suman{' '}
                  <span className="font-semibold tabular-nums">{goalGap.configured.toLocaleString('es-CO')}</span>/mes
                  {' '}— el escenario pide{' '}
                  <span className="font-semibold tabular-nums">{goalGap.required.toLocaleString('es-CO')}</span>/mes.
                  {goalGap.unconfigured > 0 && (
                    <>
                      {' '}Revisa las {goalGap.unconfigured} actividad{goalGap.unconfigured !== 1 ? 'es' : ''} marcada
                      {goalGap.unconfigured !== 1 ? 's' : ''} como <span className="font-semibold">Sin configurar</span>
                      {' '}o ajusta tus metas de citas esperadas.
                    </>
                  )}
                  {goalGap.unconfigured === 0 && ' Ajusta tus metas de citas esperadas para cerrar la brecha.'}
                </p>
              </div>
            )}

            {scenarios.some((s) => s.is_active) && (
              <div className="mb-6">
                <p className="text-xs font-semibold uppercase tracking-widest text-emerald-400 mb-3">
                  Escenario activo (usado en Dashboard)
                </p>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {scenarios.filter((s) => s.is_active).map((s) => (
                    <ScenarioCard key={s.id} scenario={s} />
                  ))}
                </div>
              </div>
            )}

            {/* Other scenarios */}
            {scenarios.some((s) => !s.is_active) && (
              <div>
                {scenarios.some((s) => s.is_active) && (
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted-foreground mb-3">
                    Otros escenarios
                  </p>
                )}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {scenarios.filter((s) => !s.is_active).map((s) => (
                    <ScenarioCard key={s.id} scenario={s} />
                  ))}
                </div>
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
