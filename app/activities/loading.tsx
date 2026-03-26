import { Skeleton } from '@/components/ui/loading-skeleton'

export default function ActivitiesLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-56" />
        </div>
        <Skeleton className="h-9 w-36 rounded-md" />
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3 bg-muted/20">
            {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-3 flex-1" />)}
          </div>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/50 last:border-0">
              <Skeleton className="flex-1 h-3.5" />
              <Skeleton className="w-24 h-5 rounded-full" />
              <Skeleton className="w-24 h-5 rounded-full" />
              <Skeleton className="w-12 h-3.5" />
              <Skeleton className="w-12 h-3.5" />
              <Skeleton className="w-8 h-8 rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
