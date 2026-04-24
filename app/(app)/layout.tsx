import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts'

function SidebarFallback() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-border bg-sidebar transition-all lg:w-60" />
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <KeyboardShortcuts />
      <Suspense fallback={<SidebarFallback />}>
        <Sidebar />
      </Suspense>
      {/* Main content offset by sidebar width */}
      <div className="ml-16 lg:ml-60 flex flex-1 flex-col overflow-hidden transition-all">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
