-- Migration 003 — Make monthly_goal the authoritative base
-- Run in Supabase SQL Editor

-- Step 1: For any activity where monthly_goal is 0 but daily_goal > 0,
--         back-calculate monthly_goal from the existing daily_goal
UPDATE activities
SET monthly_goal = daily_goal * 20
WHERE monthly_goal = 0 AND daily_goal > 0;

-- Step 2: Recalculate weekly_goal and daily_goal from monthly_goal
--         weekly = CEIL(monthly / 4)
--         daily  = CEIL(monthly / 20)
UPDATE activities
SET weekly_goal = CEIL(monthly_goal::NUMERIC / 4),
    daily_goal  = CEIL(monthly_goal::NUMERIC / 20)
WHERE monthly_goal > 0;
