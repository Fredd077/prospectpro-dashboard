import { calcRecipe } from '@/lib/calculations/recipe'
import type { RecipeScenario, Activity } from '@/lib/types/database'

export type GapStatus = 'above' | 'close' | 'below'

export interface RecipeValidation {
  scenario: { id: string; name: string }
  recipe: { outbound: number; inbound: number; total: number }
  plan:   { outbound: number; inbound: number; total: number }
  gaps:   { outbound: number; inbound: number; total: number }
  status: { outbound: GapStatus; inbound: GapStatus; total: GapStatus }
  weeklyRecipe: { outbound: number; inbound: number; total: number }
}

function gapStatus(gap: number, recipe: number): GapStatus {
  if (gap >= 0) return 'above'
  if (recipe === 0) return 'above'
  return Math.abs(gap) / recipe <= 0.1 ? 'close' : 'below'
}

/**
 * Compares the active Recipe Scenario (how many activities are NEEDED)
 * against the Activities configuration (how many activities are PLANNED).
 * Uses calcRecipe to re-derive the outbound/inbound split from the scenario.
 */
export function calcRecipeValidation(
  scenario: RecipeScenario,
  activities: Activity[],
): RecipeValidation {
  const result = calcRecipe(scenario)

  const recipeOut   = result.outbound.activities_monthly
  const recipeIn    = result.inbound.activities_monthly
  const recipeTotal = recipeOut + recipeIn

  const activeActivities = activities.filter((a) => a.status === 'active')
  const planOut   = activeActivities.filter((a) => a.type === 'OUTBOUND').reduce((s, a) => s + a.monthly_goal, 0)
  const planIn    = activeActivities.filter((a) => a.type === 'INBOUND').reduce((s, a) => s + a.monthly_goal, 0)
  const planTotal = planOut + planIn

  return {
    scenario: { id: scenario.id, name: scenario.name },
    recipe:   { outbound: recipeOut,        inbound: recipeIn,        total: recipeTotal },
    plan:     { outbound: planOut,           inbound: planIn,           total: planTotal },
    gaps:     { outbound: planOut - recipeOut, inbound: planIn - recipeIn, total: planTotal - recipeTotal },
    status:   {
      outbound: gapStatus(planOut - recipeOut, recipeOut),
      inbound:  gapStatus(planIn  - recipeIn,  recipeIn),
      total:    gapStatus(planTotal - recipeTotal, recipeTotal),
    },
    weeklyRecipe: {
      outbound: result.outbound.activities_weekly,
      inbound:  result.inbound.activities_weekly,
      total:    result.outbound.activities_weekly + result.inbound.activities_weekly,
    },
  }
}

export const STATUS_LABEL: Record<GapStatus, string> = {
  above: 'Por encima',
  close: 'Casi en meta',
  below: 'Por debajo',
}

export const STATUS_COLOR: Record<GapStatus, string> = {
  above: 'text-emerald-400',
  close: 'text-amber-400',
  below: 'text-red-400',
}

export const STATUS_BG: Record<GapStatus, string> = {
  above: 'bg-emerald-400/10 text-emerald-400',
  close: 'bg-amber-400/10 text-amber-400',
  below: 'bg-red-400/10 text-red-400',
}

export const STATUS_BAR: Record<GapStatus, string> = {
  above: 'bg-emerald-400',
  close: 'bg-amber-400',
  below: 'bg-red-400',
}
