'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  FlaskConical,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',       icon: LayoutDashboard },
  { href: '/checkin',   label: 'Check-in Diario', icon: ClipboardList   },
  { href: '/activities',label: 'Actividades',     icon: ListChecks      },
  { href: '/recipe',    label: 'Recetario',        icon: FlaskConical    },
] as const

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="fixed inset-y-0 left-0 z-40 flex w-16 flex-col border-r border-border bg-sidebar transition-all lg:w-60">
      {/* Logo / Brand */}
      <div className="flex h-14 items-center justify-center border-b border-border px-4 lg:justify-start lg:gap-3 lg:px-5">
        <div className="relative flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-primary">
          <TrendingUp className="h-4 w-4 text-primary-foreground" />
          {/* Pulse dot — live indicator */}
          <span className="pulse-dot absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-primary ring-2 ring-sidebar" />
        </div>
        <div className="hidden lg:block">
          <span className="text-sm font-bold tracking-tight text-foreground">
            ProspectPro
          </span>
          <div className="flex items-center gap-1 mt-0.5">
            <span className="h-1 w-1 rounded-full bg-primary" />
            <span className="text-[9px] uppercase tracking-[0.15em] text-muted-foreground/60">
              Command Center
            </span>
          </div>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2">
        <ul className="space-y-0.5">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive = pathname === href || pathname.startsWith(`${href}/`)
            return (
              <li key={href}>
                <Link
                  href={href}
                  title={label}
                  className={cn(
                    'relative flex items-center justify-center rounded-md px-2 py-2.5 text-sm font-medium transition-all duration-200 lg:justify-start lg:gap-3 lg:px-3',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                  )}
                >
                  {/* Active left accent bar */}
                  {isActive && (
                    <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <Icon className="h-5 w-5 shrink-0" />
                  <span className="hidden flex-1 lg:block">{label}</span>
                </Link>
              </li>
            )
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="border-t border-border px-4 py-3 lg:px-5">
        <p className="hidden text-[10px] uppercase tracking-[0.12em] text-muted-foreground/40 lg:block">
          v1.0.0
        </p>
        <div className="flex h-4 w-4 items-center justify-center lg:hidden">
          <div className="h-1 w-1 rounded-full bg-primary/40" />
        </div>
      </div>
    </aside>
  )
}
