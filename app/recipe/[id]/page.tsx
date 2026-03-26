import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { ScenarioTabs } from '@/components/recipe/ScenarioTabs'
import { getSupabaseServerClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export default async function RecipeDetailPage({ params }: Props) {
  const { id } = await params
  const sb = await getSupabaseServerClient()

  const [{ data: scenario }, { data: actuals }] = await Promise.all([
    sb.from('recipe_scenarios').select('*').eq('id', id).single(),
    sb.from('recipe_actuals').select('*').eq('scenario_id', id).order('period_start', { ascending: false }),
  ])

  if (!scenario) notFound()

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title={scenario.name}
        description={`${scenario.description ?? 'Escenario de funnel comercial'}${scenario.is_active ? ' · Activo en Dashboard' : ''}`}
        action={
          <Link href="/recipe" className={buttonVariants({ variant: 'ghost', size: 'sm' })}>
            <ChevronLeft className="h-4 w-4 mr-1" />
            Volver
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        <ScenarioTabs scenario={scenario} actuals={actuals ?? []} />
      </div>
    </div>
  )
}
