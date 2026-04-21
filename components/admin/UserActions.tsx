'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { UserCheck, UserX, ShieldCheck, ShieldOff, Users, Trash2, AlertTriangle } from 'lucide-react'
import { activateUser, deactivateUser, updateUserOrgRole, updateUserManager, deleteUser } from '@/lib/actions/admin'
import type { Profile } from '@/lib/types/database'

interface UserActionsProps {
  user: Pick<Profile, 'id' | 'role' | 'full_name' | 'email' | 'org_role' | 'manager_id'>
  managers?: { id: string; name: string }[]
  /** If true, redirects to /admin after successful deletion */
  redirectOnDelete?: boolean
}

export function UserActions({ user, managers = [], redirectOnDelete = false }: UserActionsProps) {
  const router = useRouter()
  const [loading, setLoading] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)

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

  async function handleToggleManager() {
    const isManager = user.org_role === 'manager'
    const msg = isManager
      ? `¿Quitar rol Manager a ${user.full_name ?? user.email}?`
      : `¿Asignar como Manager a ${user.full_name ?? user.email}?`
    if (!confirm(msg)) return
    setLoading('orgRole')
    await updateUserOrgRole(user.id, isManager ? 'member' : 'manager')
    setLoading(null)
  }

  async function handleManagerChange(e: React.ChangeEvent<HTMLSelectElement>) {
    const value = e.target.value
    setLoading('manager')
    await updateUserManager(user.id, value || null)
    setLoading(null)
  }

  async function handleDelete() {
    setLoading('delete')
    try {
      await deleteUser(user.id)
      if (redirectOnDelete) router.push('/admin')
    } catch (err) {
      setLoading(null)
      setConfirmDelete(false)
      alert(err instanceof Error ? err.message : 'Error al eliminar el usuario')
    }
  }

  const isManager = user.org_role === 'manager'
  const displayName = user.full_name ?? user.email

  return (
    <div className="flex flex-col gap-2">
      {/* Activate / Deactivate */}
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

      {/* Manager toggle */}
      <button
        onClick={handleToggleManager}
        disabled={loading !== null}
        title={isManager ? 'Quitar Manager' : 'Asignar como Manager'}
        className={`flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium border transition-colors disabled:opacity-50 ${
          isManager
            ? 'bg-amber-400/10 text-amber-400 border-amber-400/20 hover:bg-amber-400/20'
            : 'bg-muted/30 text-muted-foreground border-border hover:bg-muted/50'
        }`}
      >
        {loading === 'orgRole' ? (
          <span className="h-3 w-3 animate-spin rounded-full border border-current border-t-transparent" />
        ) : isManager ? (
          <ShieldOff className="h-3 w-3" />
        ) : (
          <ShieldCheck className="h-3 w-3" />
        )}
        {isManager ? 'Quitar Mgr' : 'Mgr'}
      </button>

      {/* Assign manager select — only show if there are managers and user is not a manager themselves */}
      {!isManager && managers.length > 0 && (
        <div className="flex items-center gap-1">
          <Users className="h-3 w-3 text-muted-foreground/50 shrink-0" />
          <select
            value={user.manager_id ?? ''}
            onChange={handleManagerChange}
            disabled={loading !== null}
            className="rounded border border-border bg-card px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 disabled:opacity-50 cursor-pointer max-w-[110px]"
          >
            <option value="">Sin manager</option>
            {managers.map((m) => (
              <option key={m.id} value={m.id}>{m.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Delete button */}
      {!confirmDelete ? (
        <button
          onClick={() => setConfirmDelete(true)}
          disabled={loading !== null}
          title="Eliminar usuario"
          className="flex items-center gap-1.5 rounded px-2.5 py-1 text-xs font-medium bg-destructive/8 text-destructive/70 border border-destructive/15 hover:bg-destructive/15 hover:text-destructive hover:border-destructive/30 transition-colors disabled:opacity-50"
        >
          <Trash2 className="h-3.5 w-3.5" />
          Eliminar
        </button>
      ) : (
        <div className="w-full rounded-md border border-destructive/30 bg-destructive/8 p-3 space-y-2">
          <div className="flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
            <div className="text-xs text-destructive leading-snug">
              <span className="font-semibold">¿Eliminar a {displayName}?</span>
              <br />
              Se perderán permanentemente todas sus actividades, check-ins, pipeline, reportes y datos de prospección. Esta acción no se puede deshacer.
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setConfirmDelete(false)}
              disabled={loading === 'delete'}
              className="rounded px-3 py-1 text-xs font-medium border border-border text-muted-foreground hover:bg-muted/50 transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              onClick={handleDelete}
              disabled={loading === 'delete'}
              className="flex items-center gap-1.5 rounded px-3 py-1 text-xs font-semibold bg-destructive text-white hover:bg-destructive/90 transition-colors disabled:opacity-50"
            >
              {loading === 'delete' ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-white/30 border-t-white" />
              ) : (
                <Trash2 className="h-3.5 w-3.5" />
              )}
              {loading === 'delete' ? 'Eliminando…' : 'Sí, eliminar'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
