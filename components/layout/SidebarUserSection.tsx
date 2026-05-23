'use client'

import { useState } from 'react'
import { LogOut } from 'lucide-react'
import { ThemeToggle } from './ThemeToggle'
import { useSidebar } from './SidebarContext'

interface SidebarUserSectionProps {
  fullName: string | null
  email: string
  avatarUrl: string | null
}

function Initials({ name, email }: { name: string | null; email: string }) {
  const str = name ?? email
  const parts = str.split(/[\s@]/).filter(Boolean)
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : str.slice(0, 2).toUpperCase()
  return (
    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
      {initials}
    </div>
  )
}

export function SidebarUserSection({ fullName, email, avatarUrl }: SidebarUserSectionProps) {
  const [loading, setLoading] = useState(false)
  const { collapsed } = useSidebar()

  function handleSignOut() {
    setLoading(true)
    window.location.href = '/auth/signout'
  }

  return (
    <div className="border-t border-border px-3 py-3 space-y-2">
      {/* User info */}
      <div className="flex items-center gap-2.5 overflow-hidden">
        {avatarUrl ? (
          <img
            src={avatarUrl}
            alt={fullName ?? email}
            className="h-7 w-7 shrink-0 rounded-full object-cover"
          />
        ) : (
          <Initials name={fullName} email={email} />
        )}
        {!collapsed && (
          <div className="min-w-0 flex-1">
            {fullName && (
              <p className="text-xs font-semibold text-foreground truncate leading-tight">
                {fullName}
              </p>
            )}
            <p className="text-[10px] text-muted-foreground/70 truncate leading-tight">{email}</p>
          </div>
        )}
      </div>

      {/* Theme toggle — hide when collapsed */}
      {!collapsed && <ThemeToggle />}

      {/* Sign out */}
      <button
        onClick={handleSignOut}
        disabled={loading}
        className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground disabled:opacity-50 ${collapsed ? 'justify-center' : 'justify-start'}`}
        title="Cerrar sesión"
      >
        <LogOut className="h-3.5 w-3.5 shrink-0" />
        {!collapsed && <span>Cerrar sesión</span>}
      </button>
    </div>
  )
}
