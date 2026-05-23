'use client'

import { useSidebar } from './SidebarContext'

export function MainContentShift({ children }: { children: React.ReactNode }) {
  const { collapsed } = useSidebar()
  return (
    <div
      className={`fixed inset-y-0 right-0 overflow-auto transition-all duration-300 ${
        collapsed ? 'left-16' : 'left-60'
      }`}
    >
      {children}
    </div>
  )
}
