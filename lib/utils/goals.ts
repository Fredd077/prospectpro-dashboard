import type { PeriodType } from '@/lib/types/common'

export interface ActivityGoals {
  daily_goal: number
  weekly_goal: number
  monthly_goal: number
}

/**
 * Returns the correct goal for an activity given the selected period.
 * For daily period, weekly-tracked activities (daily_goal < 1) fall back
 * to weekly_goal so bars remain visible.
 */
export function getActivityGoal(activity: ActivityGoals, period: PeriodType): number {
  if (period === 'quarterly') return activity.monthly_goal * 3
  if (period === 'monthly')   return activity.monthly_goal
  if (period === 'weekly')    return activity.weekly_goal
  // daily
  return activity.daily_goal >= 1 ? activity.daily_goal : activity.weekly_goal
}

/**
 * Implied daily goal for a single activity — used for per-day displays
 * (heatmap cells, checkin rows) regardless of the current period filter.
 * Weekly-tracked activities (daily_goal < 1) are spread over 5 days.
 */
export function getDailyImpliedGoal(activity: ActivityGoals): number {
  return activity.daily_goal >= 1 ? activity.daily_goal : activity.weekly_goal / 5
}
