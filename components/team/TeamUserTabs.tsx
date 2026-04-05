'use client'

import Link from 'next/link'
import { useSearchParams, usePathname } from 'next/navigation'
import { cn } from '@/lib/utils'

const TABS = [
  { value: 'dashboard',   label: 'Dashboard' },
  { value: 'activities',  label: 'Actividades y Metas' },
  { value: 'pipeline',    label: 'Pipeline' },
  { value: 'coach',       label: 'Reportes Coach IA' },
] as const

type Tab = typeof TABS[number]['value']

interface TeamUserTabsProps {
  activeTab: Tab
  userId: string
}

export function TeamUserTabs({ activeTab, userId }: TeamUserTabsProps) {
  return (
    <div className="flex border-b border-border px-8 gap-0">
      {TABS.map(({ value, label }) => (
        <Link
          key={value}
          href={`/team/${userId}?tab=${value}`}
          className={cn(
            'px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors',
            activeTab === value
              ? 'border-primary text-primary'
              : 'border-transparent text-muted-foreground hover:text-foreground'
          )}
        >
          {label}
        </Link>
      ))}
    </div>
  )
}
