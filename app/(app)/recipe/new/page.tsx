import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { RecipeCalculator } from '@/components/recipe/RecipeCalculator'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { getPipelineStages } from '@/lib/actions/pipeline-stages'

export const metadata: Metadata = {
  title: 'Nuevo Escenario',
}

export default async function RecipeNewPage() {
  const sb = await getSupabaseServerClient()
  const { data: { user } } = await sb.auth.getUser()
  const { data: profile } = await sb
    .from('profiles')
    .select('sales_position')
    .eq('id', user?.id ?? '')
    .maybeSingle()

  // Un escenario nuevo arranca con los nombres REALES de tu Pipeline, no con
  // el genérico "Actividad/Discurso/Reunión/Propuesta/Cierre" — así el
  // Recetario coincide con lo que ya configuraste desde el primer momento.
  const pipelineStages = await getPipelineStages()
  const defaultFunnelStages = pipelineStages.length > 0
    ? pipelineStages.slice(0, 6).map((s) => s.name)
    : undefined

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Nuevo escenario"
        description="Simula tu embudo comercial y guarda el escenario"
        action={
          <Link href="/recipe" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        <RecipeCalculator salesPosition={profile?.sales_position ?? null} defaultFunnelStages={defaultFunnelStages} />
      </div>
    </div>
  )
}
