import { Sidebar } from '@/components/layout/Sidebar'
import { KeyboardShortcuts } from '@/components/layout/KeyboardShortcuts'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full">
      <KeyboardShortcuts />
      <Sidebar />
      {/* Main content offset by sidebar width */}
      <div className="ml-16 lg:ml-60 flex flex-1 flex-col overflow-hidden transition-all">
        <main className="flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
