import { Skeleton } from '@/components/ui/loading-skeleton'

export default function CheckinLoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-36" />
          <Skeleton className="h-3.5 w-64" />
        </div>
      </div>
      <div className="flex-1 overflow-y-auto p-8">
        <div className="mx-auto max-w-2xl space-y-4">
          <Skeleton className="h-8 w-full rounded-lg" />
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-4">
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-40" />
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
              <Skeleton className="w-16 h-4" />
              <Skeleton className="w-20 h-9 rounded-md" />
            </div>
          ))}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <Skeleton className="h-9 w-32 rounded-md" />
            <Skeleton className="h-4 w-40" />
          </div>
        </div>
      </div>
    </div>
  )
}
