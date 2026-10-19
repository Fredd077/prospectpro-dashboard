import type { Metadata } from 'next'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { buttonVariants } from '@/components/ui/button-variants'
import { TopBar } from '@/components/layout/TopBar'
import { RecipeCalculator } from '@/components/recipe/RecipeCalculator'
import { getSupabaseServerClient } from '@/lib/supabase/server'

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
        <RecipeCalculator salesPosition={profile?.sales_position ?? null} />
      </div>
    </div>
  )
}
