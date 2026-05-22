'use client'

import { useState } from 'react'
import { cn } from '@/lib/utils'
import { SlidersHorizontal, FlaskConical, GitCompare, BarChart3 } from 'lucide-react'
import { RecipeCalculator } from './RecipeCalculator'
import { RecipeSimulator } from './RecipeSimulator'
import { ScenarioComparison } from './ScenarioComparison'
import { RecipePlanBanner } from './RecipePlanBanner'
import { ActivityPerformanceTab } from './ActivityPerformanceTab'
import type { RecipeScenario, RecipeActual } from '@/lib/types/database'
import type { RecipeValidation } from '@/lib/utils/recipe-validation'
import type { ActivityForSupervision } from './SupervisionPanel'

interface ScenarioTabsProps {
  scenario: RecipeScenario
  actuals: RecipeActual[]
  validation?: RecipeValidation | null
  activities?: ActivityForSupervision[]
}

const TABS = [
  { value: 'calculator',   label: 'Escenario',    icon: SlidersHorizontal },
  { value: 'simulator',    label: 'Simulador',    icon: FlaskConical },
  { value: 'comparison',   label: 'Plan vs Real', icon: GitCompare },
  { value: 'rendimiento',  label: 'Rendimiento',  icon: BarChart3 },
] as const

type TabValue = typeof TABS[number]['value']

export function ScenarioTabs({ scenario, actuals, validation, activities }: ScenarioTabsProps) {
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

      {/* Plan vs Recipe banner — always visible below tabs */}
      {validation && (
        <div className="mb-8">
          <RecipePlanBanner validation={validation} />
        </div>
      )}

      {active === 'calculator'  && (
        <RecipeCalculator scenario={scenario} activities={activities} />
      )}
      {active === 'simulator'   && <RecipeSimulator scenario={scenario} />}
      {active === 'comparison'  && <ScenarioComparison scenario={scenario} actuals={actuals} />}
      {active === 'rendimiento' && activities && activities.length > 0 && (
        <ActivityPerformanceTab scenario={scenario} activities={activities} />
      )}
      {active === 'rendimiento' && (!activities || activities.length === 0) && (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <p className="text-sm text-muted-foreground">
            Configura tus actividades primero para ver el rendimiento por actividad.
          </p>
        </div>
      )}
    </div>
  )
}
