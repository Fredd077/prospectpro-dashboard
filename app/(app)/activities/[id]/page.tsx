import { notFound } from 'next/navigation'
import { TopBar } from '@/components/layout/TopBar'
import { ActivityForm } from '@/components/activities/ActivityForm'
import { getSupabaseServerClient } from '@/lib/supabase/server'

interface Props {
  params: Promise<{ id: string }>
}

export default async function ActivityDetailPage({ params }: Props) {
  const { id } = await params
  const sb = await getSupabaseServerClient()
  const { data: activity } = await sb
    .from('activities')
    .select('*')
    .eq('id', id)
    .single()

  if (!activity) notFound()

  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Editar Actividad"
        description={activity.name}
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          <ActivityForm activity={activity} />
        </div>
      </div>
    </div>
  )
}
