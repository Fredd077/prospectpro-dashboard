import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus, FlaskConical } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { ScenarioCard } from '@/components/recipe/ScenarioCard'

export const metadata: Metadata = {
  title: 'Recetario',
  description: 'Calcula y gestiona tus escenarios de funnel comercial',
}
import { getSupabaseServerClient } from '@/lib/supabase/server'

export default async function RecipePage() {
  const sb = await getSupabaseServerClient()
  const { data: scenarios } = await sb
    .from('recipe_scenarios')
    .select('*')
    .order('is_active', { ascending: false })
    .order('created_at', { ascending: false })

  const hasScenarios = scenarios && scenarios.length > 0

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
