import { TopBar } from '@/components/layout/TopBar'
import { ActivityForm } from '@/components/activities/ActivityForm'

export default function ActivityNewPage() {
  return (
    <div className="flex flex-col h-full">
      <TopBar
        title="Nueva Actividad"
        description="Crea una nueva actividad de prospección"
      />
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl">
          <ActivityForm />
        </div>
      </div>
    </div>
  )
}
