'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  FlaskConical,
  Target,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { AtRiskBadge } from './AtRiskBadge'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',       icon: LayoutDashboard, badge: false },
  { href: '/checkin',   label: 'Check-in Diario', icon: ClipboardList,   badge: false },
  { href: '/activities',label: 'Actividades',     icon: ListChecks,      badge: false },
  { href: '/recipe',    label: 'Recetario',        icon: FlaskConical,    badge: false },
  { href: '/goals',     label: 'Metas',            icon: Target,          badge: true  },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-border bg-sidebar transition-all lg:w-60">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center justify-center border-b border-border px-4 lg:justify-start lg:gap-2.5 lg:px-5">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-blue-500">
          <TrendingUp className="h-4 w-4 text-white" />
        </div>
        <span className="hidden text-sm font-semibold tracking-tight text-foreground lg:block">
          ProspectPro
        </span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon, badge }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  className={cn(
                    'flex items-center justify-center rounded-md px-2 py-2 text-sm font-medium transition-colors lg:justify-start lg:gap-3 lg:px-3',
                    isActive
                      ? 'bg-accent text-foreground'
                      : 'text-muted-foreground hover:bg-accent/50 hover:text-foreground'
                  )}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="hidden flex-1 lg:block">{label}</span>
                  {badge && (
                    <span className="hidden lg:block">
                      <AtRiskBadge />
                    </span>
                  )}
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 lg:px-5">
        <p className="hidden text-xs text-muted-foreground lg:block">v1.0.0</p>
        <div className="flex h-4 w-4 items-center justify-center lg:hidden">
          <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/40" />
        </div>
      </div>
    </aside>
  )
}
