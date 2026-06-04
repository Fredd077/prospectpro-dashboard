import { Suspense } from 'react'
import { Sidebar } from '@/components/layout/Sidebar'
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts'
import { SidebarProvider } from '@/components/layout/SidebarContext'
import { MainContentShift } from '@/components/layout/MainContentShift'
import { TrialBanner } from '@/components/trial/TrialBannerWrapper'

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
          <div className="flex h-full flex-col">
            <Suspense>
              <TrialBanner />
            </Suspense>
            <main className="flex-1 overflow-hidden">{children}</main>
          </div>
        </MainContentShift>
      </div>
    </SidebarProvider>
  )
}
