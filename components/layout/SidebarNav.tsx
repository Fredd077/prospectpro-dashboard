'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  ListChecks,
  ClipboardList,
  FlaskConical,
  ShieldCheck,
  Bot,
  Users,
  TrendingUp,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { href: '/dashboard', label: 'Dashboard',         icon: LayoutDashboard },
  { href: '/checkin',   label: 'Check-in Diario',   icon: ClipboardList   },
  { href: '/pipeline',  label: 'Mi Pipeline',       icon: TrendingUp      },
  { href: '/coach',     label: 'Reportes Coach IA', icon: Bot             },
  { href: '/activities',label: 'Actividades',       icon: ListChecks      },
  { href: '/recipe',    label: 'Recetario',          icon: FlaskConical    },
] as const

interface SidebarNavProps {
  isAdmin: boolean
  unreadCoachCount: number
}

export function SidebarNav({ isAdmin, unreadCoachCount }: SidebarNavProps) {
  const pathname = usePathname()
  const isTeamView = pathname.startsWith('/team')

  const allItems = [
    ...navItems,
    ...(isAdmin ? [
      { href: '/team'  as const, label: 'Mi Equipo',   icon: Users       },
      { href: '/admin' as const, label: 'Admin Panel', icon: ShieldCheck },
    ] : []),
  ]

  return (
    <nav className="flex-1 overflow-y-auto py-3 px-2 flex flex-col">
      {/* Context toggle — admin only */}
      {isAdmin && (
        <div className="mb-2 px-1 hidden lg:block">
          <div className="flex rounded-md bg-muted/40 p-0.5 text-[10px] font-semibold">
            <Link
              href="/dashboard"
              className={cn(
                'flex-1 rounded py-1.5 text-center transition-colors',
                !isTeamView
                  ? 'bg-sidebar text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              👤 Mi Prospección
            </Link>
            <Link
              href="/team"
              className={cn(
                'flex-1 rounded py-1.5 text-center transition-colors',
                isTeamView
                  ? 'bg-sidebar text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              👥 Mi Equipo
            </Link>
          </div>
        </div>
      )}

      <ul className="space-y-0.5">
        {allItems.map(({ href, label, icon: Icon }) => {
          const isActive = pathname === href || pathname.startsWith(`${href}/`)
          const showBadge = href === '/coach' && unreadCoachCount > 0 && !isActive
          return (
            <li key={href}>
              <Link
                href={href}
                title={label}
                className={cn(
                  'relative flex items-center justify-center rounded-md px-2 py-2.5 text-sm font-medium transition-all duration-200 lg:justify-start lg:gap-3 lg:px-3',
                  isActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground',
                  href === '/admin' && !isActive && 'text-warning/70 hover:text-warning',
                  href === '/team'  && !isActive && 'text-cyan-500/70 hover:text-cyan-400',
                )}
              >
                {isActive && (
                  <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                )}
                <span className="relative shrink-0">
                  <Icon className="h-5 w-5" />
                  {showBadge && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-red-500 text-[9px] font-bold text-white ring-2 ring-sidebar">
                      {unreadCoachCount > 9 ? '9+' : unreadCoachCount}
                    </span>
                  )}
                </span>
                <span className="hidden flex-1 lg:block">{label}</span>
                {showBadge && (
                  <span className="hidden lg:flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                    {unreadCoachCount > 9 ? '9+' : unreadCoachCount}
                  </span>
                )}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
