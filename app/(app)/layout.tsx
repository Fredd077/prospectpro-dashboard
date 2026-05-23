import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { MainContentShift } from '@/components/layout/MainContentShift'

function SidebarFallback() {
  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-border bg-sidebar transition-all" />
  )
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <SidebarProvider>
      <div className="flex h-full">
        <KeyboardShortcuts />
        <Suspense fallback={<SidebarFallback />}>
          <Sidebar />
        </Suspense>
        <MainContentShift>
          <main className="h-full">{children}</main>
        </MainContentShift>
      </div>
    </SidebarProvider>
  )
}
