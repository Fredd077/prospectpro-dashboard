import { Skeleton } from '@/components/ui/loading-skeleton'

export default function GerenteAILoading() {
  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center justify-between border-b border-border bg-background px-8 py-4">
        <div className="space-y-1.5">
          <Skeleton className="h-5 w-28" />
          <Skeleton className="h-3.5 w-52" />
        </div>
      </div>
      {/* Filters bar */}
      <div className="flex items-center gap-3 px-6 py-3 border-b border-border">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-6 w-64" />
      </div>
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* KPI row */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-2">
                <Skeleton className="h-3 w-20" />
                <Skeleton className="h-7 w-14" />
                <Skeleton className="h-2.5 w-16" />
              </div>
            ))}
          </div>
          {/* Charts grid */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-48" />
              <Skeleton className="h-[220px] w-full rounded-lg" />
            </div>
            <div className="rounded-xl border border-border bg-card p-5 space-y-3">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-[220px] w-full rounded-lg" />
            </div>
          </div>
          {/* Rep cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="space-y-1.5">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-3 w-36" />
                  </div>
                  <Skeleton className="h-6 w-12" />
                </div>
                <Skeleton className="h-8 w-full rounded" />
                <div className="grid grid-cols-2 gap-2">
                  <Skeleton className="h-14 rounded-md" />
                  <Skeleton className="h-14 rounded-md" />
                </div>
              </div>
            ))}
          </div>
        </div>
        {/* Chat panel placeholder */}
        <div className="hidden xl:flex w-[380px] border-l border-border flex-col p-4 space-y-3">
          <Skeleton className="h-10 w-full rounded-lg" />
          <div className="flex-1 space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className={`h-8 rounded-xl ${i % 2 === 0 ? 'w-4/5' : 'w-3/5 ml-auto'}`} />
            ))}
          </div>
          <Skeleton className="h-12 w-full rounded-xl" />
        </div>
      </div>
    </div>
  )
}
