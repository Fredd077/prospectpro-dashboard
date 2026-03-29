import { KpiCardSkeleton, ChartSkeleton, Skeleton } from '@/components/ui/loading-skeleton'

export default function DashboardLoading() {
  return (
    <div className="flex flex-col h-full">
      {/* TopBar skeleton */}
      <div className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-3.5 w-56" />
        </div>
      </div>
      {/* Controls */}
      <div className="flex items-center gap-4 border-b border-border bg-background px-8 py-3">
        <Skeleton className="h-8 w-72 rounded-lg" />
        <Skeleton className="h-8 w-32 rounded-lg" />
      </div>
      <div className="p-8 space-y-8">
        {/* KPI Grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => <KpiCardSkeleton key={i} />)}
        </div>
        {/* Activity table skeleton */}
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <Skeleton className="h-4 w-48" />
          </div>
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-4 py-3 border-b border-border/50">
              <Skeleton className="flex-1 h-3" />
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-16 h-3" />
              <Skeleton className="w-20 h-3" />
              <Skeleton className="w-20 h-6 rounded" />
            </div>
          ))}
        </div>
        {/* Chart */}
        <div className="rounded-lg border border-border bg-card p-6">
          <Skeleton className="h-4 w-32 mb-6" />
          <ChartSkeleton />
        </div>
      </div>
    </div>
  )
}
