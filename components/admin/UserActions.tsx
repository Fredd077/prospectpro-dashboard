'use client'

import { useState } from 'react'
import { UserCheck, UserX } from 'lucide-react'
import { activateUser, deactivateUser } from '@/lib/actions/admin'
import type { Profile } from '@/lib/types/database'

export function UserActions({ user }: { user: Pick<Profile, 'id' | 'role' | 'full_name' | 'email'> }) {
  const [loading, setLoading] = useState<string | null>(null)

  async function handleActivate() {
    if (!confirm(`¿Activar la cuenta de ${user.full_name ?? user.email}?`)) return
    setLoading('activate')
    await activateUser(user.id)
    setLoading(null)
  }

  async function handleDeactivate() {
    if (!confirm(`¿Desactivar la cuenta de ${user.full_name ?? user.email}?`)) return
    setLoading('deactivate')
    await deactivateUser(user.id)
    setLoading(null)
  }

  return (
    <div className="flex items-center gap-1.5">
      {user.role === 'pending' && (
        <button
          onClick={handleActivate}
          disabled={loading !== null}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50"
        >
          {loading === 'activate' ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-success/30 border-t-success" />
          ) : (
            <UserCheck className="h-3.5 w-3.5" />
          )}
          Activar
        </button>
      )}
      {user.role === 'active' && (
        <button
          onClick={handleDeactivate}
          disabled={loading !== null}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium bg-destructive/10 text-destructive border border-destructive/20 hover:bg-destructive/20 transition-colors disabled:opacity-50"
        >
          {loading === 'deactivate' ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-destructive/30 border-t-destructive" />
          ) : (
            <UserX className="h-3.5 w-3.5" />
          )}
          Desactivar
        </button>
      )}
      {user.role === 'inactive' && (
        <button
          onClick={handleActivate}
          disabled={loading !== null}
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium bg-success/10 text-success border border-success/20 hover:bg-success/20 transition-colors disabled:opacity-50"
        >
          {loading === 'activate' ? (
            <span className="h-3 w-3 animate-spin rounded-full border border-success/30 border-t-success" />
          ) : (
            <UserCheck className="h-3.5 w-3.5" />
          )}
          Reactivar
        </button>
      )}
    </div>
  )
}
