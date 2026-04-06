'use client'

import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { useCallback } from 'react'
import { Users } from 'lucide-react'
import { cn } from '@/lib/utils'

interface Member {
  id: string
  full_name: string | null
  email: string
}

interface TeamMemberFilterProps {
  members: Member[]
  selectedIds: string[]
}

export function TeamMemberFilter({ members, selectedIds }: TeamMemberFilterProps) {
  const router   = useRouter()
  const pathname = usePathname()
  const sp       = useSearchParams()

  const isAll = selectedIds.length === 0 || selectedIds.length === members.length

  const update = useCallback((ids: string[]) => {
    const params = new URLSearchParams(sp.toString())
    if (ids.length === 0 || ids.length === members.length) {
      params.delete('users')
    } else {
      params.set('users', ids.join(','))
    }
    router.push(`${pathname}?${params.toString()}`)
  }, [router, pathname, sp, members.length])

  function toggleAll() {
    update([])
  }

  function toggleMember(id: string) {
    if (isAll) {
      // Entering manual selection: pick only this one
      update([id])
    } else {
      const next = selectedIds.includes(id)
        ? selectedIds.filter((x) => x !== id)
        : [...selectedIds, id]
      update(next.length === members.length ? [] : next)
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground uppercase tracking-wider shrink-0">
        <Users className="h-3 w-3" />
        Miembros:
      </div>

      {/* All-team pill */}
      <button
        onClick={toggleAll}
        className={cn(
          'rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-colors',
          isAll
            ? 'bg-primary/15 text-primary border-primary/30'
            : 'text-muted-foreground border-border hover:border-muted-foreground/40'
        )}
      >
        Todo el equipo
      </button>

      {/* Individual member pills */}
      {members.map((m) => {
        const isSelected = !isAll && selectedIds.includes(m.id)
        return (
          <button
            key={m.id}
            onClick={() => toggleMember(m.id)}
            className={cn(
              'rounded-full px-2.5 py-1 text-[10px] font-semibold border transition-colors',
              isSelected
                ? 'bg-primary/15 text-primary border-primary/30'
                : 'text-muted-foreground border-border hover:border-muted-foreground/40'
            )}
          >
            {m.full_name ?? m.email.split('@')[0]}
          </button>
        )
      })}
    </div>
  )
}
