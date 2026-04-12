'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FunnelSectionProps {
  children: React.ReactNode
}

export function FunnelSection({ children }: FunnelSectionProps) {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Funnel Real — este mes</h2>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="p-1 rounded text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={cn('h-4 w-4 transition-transform duration-200', collapsed && 'rotate-180')} />
        </button>
      </div>
      {!collapsed && children}
    </div>
  )
}
