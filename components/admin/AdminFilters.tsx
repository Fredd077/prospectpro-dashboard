'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const ROLES = [
  { value: 'all',      label: 'Todos'      },
  { value: 'pending',  label: 'Pendientes' },
  { value: 'active',   label: 'Activos'    },
  { value: 'inactive', label: 'Inactivos'  },
  { value: 'admin',    label: 'Admin'      },
]

export function AdminFilters() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const current = searchParams.get('role') ?? 'all'

  function setRole(role: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set('role', role)
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-1.5 flex-wrap">
      {ROLES.map(({ value, label }) => (
        <button
          key={value}
          onClick={() => setRole(value)}
          className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
            current === value
              ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,217,255,0.2)]'
              : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
          }`}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
