import { Skeleton } from '@/components/ui/loading-skeleton'

function ScenarioCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-3 w-56" />
        </div>
        <Skeleton className="h-7 w-7 rounded-md" />
      </div>
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded bg-muted/30 px-2.5 py-1.5 space-y-1">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
      <Skeleton className="h-9 w-full rounded-md" />
    </div>
  )
}

export default function RecipeLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-48" />
          <Skeleton className="h-3.5 w-72" />
        </div>
        <Skeleton className="h-9 w-40 rounded-md" />
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => <ScenarioCardSkeleton key={i} />)}
        </div>
      </div>
    </div>
  )
}
