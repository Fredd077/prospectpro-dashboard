'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search } from 'lucide-react'
import { useCallback } from 'react'
import { cn } from '@/lib/utils'

interface TeamFiltersProps {
  companies: string[]
  currentCompany: string
  currentStatus: string
  currentSort: string
}

const STATUS_OPTIONS = [
  { value: 'all',      label: 'Todos' },
  { value: 'ontrack',  label: 'En meta ≥70%' },
  { value: 'atrisk',   label: 'En riesgo 40-69%' },
  { value: 'critical', label: 'Crítico <40%' },
]

const SORT_OPTIONS = [
  { value: 'compliance', label: 'Cumplimiento' },
  { value: 'activities', label: 'Actividades' },
  { value: 'checkin',    label: 'Último check-in' },
]

export function TeamFilters({ companies, currentCompany, currentStatus, currentSort }: TeamFiltersProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const update = useCallback((key: string, value: string) => {
    const params = new URLSearchParams(sp.toString())
    if (value) params.set(key, value)
    else params.delete(key)
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, sp])

  return (
    <div className="flex flex-wrap gap-3 items-center">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
        <input
          type="text"
          defaultValue={sp.get('search') ?? ''}
          onChange={(e) => update('search', e.target.value)}
          placeholder="Buscar por nombre o email..."
          className="pl-8 pr-3 py-1.5 text-xs rounded-md border border-border bg-transparent focus:outline-none focus:ring-1 focus:ring-primary/30 w-52"
        />
      </div>

      {/* Company filter */}
      <select
        value={currentCompany}
        onChange={(e) => update('company', e.target.value)}
        className="text-xs rounded-md border border-border bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&>option]:bg-card [&>option]:text-foreground"
      >
        <option value="">Todas las empresas</option>
        {companies.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>

      {/* Status filter */}
      <div className="flex gap-1">
        {STATUS_OPTIONS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => update('status', value === 'all' ? '' : value)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-colors',
              currentStatus === value || (value === 'all' && !currentStatus)
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'text-muted-foreground border-border hover:border-muted-foreground/40'
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Sort */}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Ordenar:</span>
        <select
          value={currentSort}
          onChange={(e) => update('sort', e.target.value)}
          className="text-xs rounded-md border border-border bg-card text-foreground px-2.5 py-1.5 focus:outline-none focus:ring-1 focus:ring-primary/30 [&>option]:bg-card [&>option]:text-foreground"
        >
          {SORT_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>
    </div>
  )
}
