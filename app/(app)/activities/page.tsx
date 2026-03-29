import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { ActivityTable } from '@/components/activities/ActivityTable'
import { RecipeValidationBanner } from '@/components/activities/RecipeValidationBanner'
import { getSupabaseServerClient } from '@/lib/supabase/server'
import { calcRecipeValidation } from '@/lib/utils/recipe-validation'

export const metadata: Metadata = {
  title: 'Actividades',
  description: 'Gestiona tus actividades de prospección comercial',
}

export default async function ActivitiesPage() {
  const sb = await getSupabaseServerClient()

  const [{ data: activities, error }, { data: activeScenario }] = await Promise.all([
    sb
      .from('activities')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true }),
    sb
      .from('recipe_scenarios')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  if (error) {
    return (
      <div className="p-8 text-sm text-destructive">
        Error cargando actividades: {error.message}
      </div>
    )
  }

  const validation = activeScenario && activities
    ? calcRecipeValidation(activeScenario, activities)
    : null

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Actividades"
        description={`${activities?.length ?? 0} actividades configuradas`}
        action={
          <Link href="/activities/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva actividad
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8 space-y-6">
        <RecipeValidationBanner validation={validation} />
        <ActivityTable activities={activities ?? []} />
      </div>
    </div>
  )
}
