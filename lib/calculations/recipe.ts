// Default funnel configuration — used as fallback across the app
export const DEFAULT_FUNNEL_STAGES = ['Actividad', 'Discurso', 'Reunión', 'Propuesta', 'Cierre']
export const DEFAULT_OUTBOUND_RATES = [80, 10, 50, 30]
export const DEFAULT_INBOUND_RATES  = [100, 100, 50, 30]

export interface RecipeInputs {
  monthly_revenue_goal: number
  outbound_pct: number
  average_ticket: number
  working_days_per_month: number
  // Dynamic funnel — arrays must be parallel:
  //   funnel_stages.length = N stages
  //   outbound_rates.length = inbound_rates.length = N - 1 transitions
  funnel_stages: string[]
  outbound_rates: number[]
  inbound_rates: number[]
}

export interface ChannelFunnel {
  revenue_goal: number
  stage_names: string[]   // label for each stage
  stage_values: number[]  // calculated value per stage (parallel to stage_names)
  activities_monthly: number  // = stage_values[0]
  activities_weekly: number
  activities_daily: number
  closes_needed: number       // = stage_values[last]
}

export interface RecipeOutputs {
  outbound: ChannelFunnel
  inbound:  ChannelFunnel
  // Combined totals
  activities_needed_monthly: number
  activities_needed_weekly:  number
  activities_needed_daily:   number
  closes_needed_monthly:     number
}

function calcFunnel(
  revenue_goal: number,
  average_ticket: number,
  working_days: number,
  stage_names: string[],
  rates: number[],
): ChannelFunnel {
  const safe = (n: number) => (n <= 0 ? 0.0001 : n)
  const n = stage_names.length

  // Work backwards from closes (last stage) to activities (first stage)
  const raw = new Array(n).fill(0)
  raw[n - 1] = revenue_goal / safe(average_ticket) // closes needed
  for (let i = rates.length - 1; i >= 0; i--) {
    raw[i] = raw[i + 1] / (safe(rates[i]) / 100)
  }

  const values = raw.map(Math.ceil)
  const acts_mo  = values[0]
  const acts_wk  = Math.ceil(acts_mo / (safe(working_days) / 5))
  const acts_day = Math.ceil(acts_mo / safe(working_days))

  return {
    revenue_goal,
    stage_names,
    stage_values: values,
    activities_monthly: acts_mo,
    activities_weekly:  acts_wk,
    activities_daily:   acts_day,
    closes_needed:      values[n - 1],
  }
}

export function calcRecipe(inputs: RecipeInputs): RecipeOutputs {
  const {
    monthly_revenue_goal,
    outbound_pct,
    average_ticket,
    working_days_per_month,
    funnel_stages,
    outbound_rates,
    inbound_rates,
  } = inputs

  const outbound_goal = monthly_revenue_goal * (outbound_pct / 100)
  const inbound_goal  = monthly_revenue_goal * ((100 - outbound_pct) / 100)

  const outbound = calcFunnel(outbound_goal, average_ticket, working_days_per_month, funnel_stages, outbound_rates)
  const inbound  = calcFunnel(inbound_goal,  average_ticket, working_days_per_month, funnel_stages, inbound_rates)

  return {
    outbound,
    inbound,
    activities_needed_monthly: outbound.activities_monthly + inbound.activities_monthly,
    activities_needed_weekly:  outbound.activities_weekly  + inbound.activities_weekly,
    activities_needed_daily:   outbound.activities_daily   + inbound.activities_daily,
    closes_needed_monthly:     outbound.closes_needed      + inbound.closes_needed,
  }
}

/** Resize a rates array when stage count changes. New transitions default to 50%. */
export function adjustRates(rates: number[], newTransitions: number): number[] {
  if (rates.length === newTransitions) return rates
  if (rates.length > newTransitions) return rates.slice(0, newTransitions)
  return [...rates, ...Array(newTransitions - rates.length).fill(50)]
}
