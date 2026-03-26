export interface RecipeInputs {
  monthly_revenue_goal: number
  outbound_pct: number
  average_ticket: number
  working_days_per_month: number
  // Outbound conversion rates
  conv_activity_to_speech: number
  conv_speech_to_meeting: number
  conv_meeting_to_proposal: number
  conv_proposal_to_close: number
  // Inbound conversion rates (independent)
  inbound_conv_activity_to_speech: number
  inbound_conv_speech_to_meeting: number
  inbound_conv_meeting_to_proposal: number
  inbound_conv_proposal_to_close: number
}

export interface ChannelFunnel {
  revenue_goal: number
  closes_needed: number
  proposals_needed: number
  meetings_needed: number
  speeches_needed: number
  activities_monthly: number
  activities_weekly: number
  activities_daily: number
}

export interface RecipeOutputs {
  // Split funnels
  outbound: ChannelFunnel
  inbound: ChannelFunnel
  // Combined totals (used by ScenarioComparison / DB storage)
  closes_needed_monthly: number
  proposals_needed_monthly: number
  meetings_needed_monthly: number
  speeches_needed_monthly: number
  activities_needed_monthly: number
  activities_needed_weekly: number
  activities_needed_daily: number
}

function calcFunnel(
  revenue_goal: number,
  average_ticket: number,
  working_days: number,
  conv_a2s: number,
  conv_s2m: number,
  conv_m2p: number,
  conv_p2c: number,
): ChannelFunnel {
  const safe = (n: number) => (n <= 0 ? 0.0001 : n)
  const closes    = revenue_goal / safe(average_ticket)
  const proposals = closes / (safe(conv_p2c) / 100)
  const meetings  = proposals / (safe(conv_m2p) / 100)
  const speeches  = meetings / (safe(conv_s2m) / 100)
  const acts_mo   = speeches / (safe(conv_a2s) / 100)
  const acts_wk   = acts_mo / (safe(working_days) / 5)
  const acts_day  = acts_mo / safe(working_days)
  return {
    revenue_goal,
    closes_needed:      Math.ceil(closes),
    proposals_needed:   Math.ceil(proposals),
    meetings_needed:    Math.ceil(meetings),
    speeches_needed:    Math.ceil(speeches),
    activities_monthly: Math.ceil(acts_mo),
    activities_weekly:  Math.ceil(acts_wk),
    activities_daily:   Math.ceil(acts_day),
  }
}

export function calcRecipe(inputs: RecipeInputs): RecipeOutputs {
  const {
    monthly_revenue_goal,
    outbound_pct,
    average_ticket,
    working_days_per_month,
    conv_activity_to_speech,
    conv_speech_to_meeting,
    conv_meeting_to_proposal,
    conv_proposal_to_close,
    inbound_conv_activity_to_speech,
    inbound_conv_speech_to_meeting,
    inbound_conv_meeting_to_proposal,
    inbound_conv_proposal_to_close,
  } = inputs

  const outbound_goal = monthly_revenue_goal * (outbound_pct / 100)
  const inbound_goal  = monthly_revenue_goal * ((100 - outbound_pct) / 100)

  const outbound = calcFunnel(
    outbound_goal, average_ticket, working_days_per_month,
    conv_activity_to_speech, conv_speech_to_meeting,
    conv_meeting_to_proposal, conv_proposal_to_close,
  )

  const inbound = calcFunnel(
    inbound_goal, average_ticket, working_days_per_month,
    inbound_conv_activity_to_speech, inbound_conv_speech_to_meeting,
    inbound_conv_meeting_to_proposal, inbound_conv_proposal_to_close,
  )

  return {
    outbound,
    inbound,
    closes_needed_monthly:    outbound.closes_needed    + inbound.closes_needed,
    proposals_needed_monthly: outbound.proposals_needed + inbound.proposals_needed,
    meetings_needed_monthly:  outbound.meetings_needed  + inbound.meetings_needed,
    speeches_needed_monthly:  outbound.speeches_needed  + inbound.speeches_needed,
    activities_needed_monthly: outbound.activities_monthly + inbound.activities_monthly,
    activities_needed_weekly:  outbound.activities_weekly  + inbound.activities_weekly,
    activities_needed_daily:   outbound.activities_daily   + inbound.activities_daily,
  }
}
