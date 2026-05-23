'use client'

import { TrendingUp, PanelLeftClose, PanelLeftOpen } from 'lucide-react'
import { useSidebar } from './SidebarContext'

export function SidebarClientShell({ nav, user }: { nav: React.ReactNode; user: React.ReactNode }) {
  const { collapsed, toggle } = useSidebar()

  return (
    <aside
      className={`fixed inset-y-0 left-0 z-40 flex flex-col border-r border-border bg-sidebar transition-all duration-300 ${
        collapsed ? 'w-16' : 'w-60'
      }`}
    >
      {/* Header: logo + toggle */}
      <div className="relative flex h-14 shrink-0 items-center border-b border-border px-4">
        <div className={`flex items-center gap-3 overflow-hidden transition-all duration-300 ${collapsed ? 'w-8' : 'w-full'}`}>
          <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
            <TrendingUp className="h-4 w-4 text-primary-foreground" />
            <span className="pulse-dot absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <span className="block text-sm font-bold tracking-tight text-foreground">ProspectPro</span>
              <div className="flex items-center gap-1 mt-0.5">
                <span className="h-1 w-1 rounded-full bg-primary" />
                <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60">
                  Command Center
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Toggle button — floats on the right edge */}
        <button
          onClick={toggle}
          title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
          className="absolute -right-3 top-1/2 -translate-y-1/2 z-50 flex h-6 w-6 items-center justify-center rounded-full border border-border bg-sidebar text-muted-foreground shadow-sm transition-colors hover:bg-muted hover:text-foreground"
        >
          {collapsed
            ? <PanelLeftOpen  className="h-3 w-3" />
            : <PanelLeftClose className="h-3 w-3" />}
        </button>
      </div>

      {nav}
      {user}
    </aside>
  )
}
