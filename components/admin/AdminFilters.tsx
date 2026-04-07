'use client'

import { useRouter, useSearchParams } from 'next/navigation'

const ROLES = [
  { value: 'all',      label: 'Todos'      },
  { value: 'pending',  label: 'Pendientes' },
  { value: 'active',   label: 'Activos'    },
  { value: 'inactive', label: 'Inactivos'  },
  { value: 'admin',    label: 'Admin'      },
]

interface AdminFiltersProps {
  companies?: string[]
}

export function AdminFilters({ companies }: AdminFiltersProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentRole = searchParams.get('role') ?? 'all'
  const currentCompany = searchParams.get('company') ?? 'all'

  function setParam(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString())
    params.set(key, value)
    router.push(`/admin?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {/* Company filter */}
      {companies && companies.length > 1 && (
        <select
          value={currentCompany}
          onChange={(e) => setParam('company', e.target.value)}
          className="rounded-md border border-border bg-card px-3 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/40 cursor-pointer"
        >
          <option value="all">Todas las empresas</option>
          {companies.filter((c) => c !== 'all').map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      )}

      {/* Role filter pills */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {ROLES.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setParam('role', value)}
            className={`rounded-md px-3 py-1.5 text-xs font-medium transition-all ${
              currentRole === value
                ? 'bg-primary text-primary-foreground shadow-[0_0_10px_rgba(0,217,255,0.2)]'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50 border border-border'
            }`}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
