import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserActions } from './UserActions'
import { CompanyCell } from './CompanyCell'
import type { Profile } from '@/lib/types/database'

const ROLE_BADGE: Record<Profile['role'], { label: string; cls: string }> = {
  pending:  { label: 'Pendiente', cls: 'bg-warning/10 text-warning border-warning/20' },
  active:   { label: 'Activo',    cls: 'bg-success/10 text-success border-success/20' },
  inactive: { label: 'Inactivo',  cls: 'bg-muted text-muted-foreground border-border' },
  admin:    { label: 'Admin',     cls: 'bg-primary/10 text-primary border-primary/20' },
}

function Avatar({ name, email, avatarUrl }: { name: string | null; email: string; avatarUrl: string | null }) {
  const str = name ?? email
  const parts = str.split(/[\s@]/).filter(Boolean)
  const initials =
    parts.length >= 2
      ? `${parts[0][0]}${parts[1][0]}`.toUpperCase()
      : str.slice(0, 2).toUpperCase()

  return avatarUrl ? (
    <img src={avatarUrl} alt={name ?? email} className="h-7 w-7 rounded-full object-cover" />
  ) : (
    <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-[10px] font-bold text-primary">
      {initials}
    </div>
  )
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('es-CO', {
    day: '2-digit', month: 'short', year: 'numeric',
  })
}

interface UsersTableProps {
  users: Profile[]
  filterRole: string
}

export function UsersTable({ users, filterRole }: UsersTableProps) {
  const filtered = filterRole === 'all'
    ? users
    : users.filter((u) => u.role === filterRole)

  if (filtered.length === 0) {
    return (
      <div className="rounded-lg border border-border bg-card py-12 text-center text-sm text-muted-foreground">
        No hay usuarios en esta categoría.
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-muted/30">
            <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Usuario
            </th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden md:table-cell">
              Empresa
            </th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Estado
            </th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
              Registrado
            </th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground hidden lg:table-cell">
              Último acceso
            </th>
            <th className="px-4 py-3 text-left text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              Acciones
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/50">
          {filtered.map((user) => {
            const badge = ROLE_BADGE[user.role]
            return (
              <tr key={user.id} className="hover:bg-muted/20 transition-colors">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar
                      name={user.full_name}
                      email={user.email}
                      avatarUrl={user.avatar_url}
                    />
                    <div>
                      <p className="font-medium text-foreground text-xs">
                        {user.full_name ?? '—'}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{user.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 hidden md:table-cell">
                  <CompanyCell userId={user.id} initialValue={user.company ?? null} />
                </td>
                <td className="px-4 py-3">
                  <span className={cn('rounded border px-1.5 py-0.5 text-[10px] font-medium', badge.cls)}>
                    {badge.label}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-data hidden lg:table-cell">
                  {formatDate(user.created_at)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground font-data hidden lg:table-cell">
                  {formatDate(user.last_seen_at)}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <UserActions user={user} />
                    <Link
                      href={`/team/${user.id}`}
                      className="flex items-center gap-1 rounded px-2 py-1 text-[10px] text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
                    >
                      <ExternalLink className="h-3 w-3" />
                      Ver perfil
                    </Link>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
