'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SlidersHorizontal, FlaskConical, GitCompare } from 'lucide-react'
import { RecipeCalculator } from './RecipeCalculator'
import { RecipeSimulator } from './RecipeSimulator'
import { ScenarioComparison } from './ScenarioComparison'
import type { RecipeScenario, RecipeActual } from '@/lib/types/database'

interface ScenarioTabsProps {
  scenario: RecipeScenario
  actuals: RecipeActual[]
}

const TABS = [
  { value: 'calculator', label: 'Escenario',  icon: SlidersHorizontal },
  { value: 'simulator',  label: 'Simulador',  icon: FlaskConical },
  { value: 'comparison', label: 'Plan vs Real', icon: GitCompare },
] as const

type TabValue = typeof TABS[number]['value']

export function ScenarioTabs({ scenario, actuals }: ScenarioTabsProps) {
  const [active, setActive] = useState<TabValue>('calculator')

  return (
    <div>
      {/* Tab bar */}
      <div className="flex items-center gap-1 border-b border-border mb-8 pb-0">
        {TABS.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            type="button"
            onClick={() => setActive(value)}
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px',
              active === value
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:border-border'
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </button>
        ))}
      </div>

      {active === 'calculator' && <RecipeCalculator scenario={scenario} />}
      {active === 'simulator'  && <RecipeSimulator scenario={scenario} />}
      {active === 'comparison' && <ScenarioComparison scenario={scenario} actuals={actuals} />}
    </div>
  )
}
