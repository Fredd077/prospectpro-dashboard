import type { Metadata } from 'next'
import Link from 'next/link'
import { Plus } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { WeightDistributor } from '@/components/activities/WeightDistributor'
import { getSupabaseServerClient } from '@/lib/supabase/server'

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

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Actividades"
        description="Distribuye el peso de cada actividad para calcular tus metas automáticamente"
        action={
          <Link href="/activities/new" className={buttonVariants({ size: 'sm' })}>
            <Plus className="mr-2 h-4 w-4" />
            Nueva actividad
          </Link>
        }
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-3xl">
          <WeightDistributor activities={activities ?? []} activeScenario={activeScenario ?? null} />
        </div>
      </div>
    </div>
  )
}
