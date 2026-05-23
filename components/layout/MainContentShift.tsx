'use client'

import { useSidebar } from './SidebarContext'

export function MainContentShift({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div
      className={`flex flex-1 flex-col min-w-0 transition-all duration-300 ${
        collapsed ? 'ml-16' : 'ml-60'
      }`}
    >
      {children}
    </div>
  )
}
