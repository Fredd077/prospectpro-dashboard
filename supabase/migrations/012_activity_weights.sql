-- ══════════════════════════════════════════════════════════════
-- 012_activity_weights.sql
--
-- 1. Add weight NUMERIC(5,2) column to activities.
--    weight represents the activity's share of its type group's
--    total monthly target (outbound or inbound).
--    0 ≤ weight ≤ 100. All active activities of the same type
--    for a user must sum to 100.
--
-- 2. Backfill existing active activities with equal weights:
--    e.g. 5 outbound activities → 20.00% each
--         3 outbound activities → 33.33%, 33.33%, 33.34%
--    (last activity gets the remainder to ensure exact 100.00 sum)
--
-- 3. Inactive activities are left at 0 — they are excluded from
--    the 100% validation on the UI.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE activities
  ADD COLUMN IF NOT EXISTS weight NUMERIC(5,2) DEFAULT 0
    CHECK (weight >= 0 AND weight <= 100);

-- ─── Backfill active activities with equal weights ─────────────
WITH ranked AS (
  SELECT
    id,
    ROW_NUMBER() OVER (PARTITION BY user_id, type ORDER BY sort_order, name) AS rn,
    COUNT(*)     OVER (PARTITION BY user_id, type)                           AS cnt
  FROM activities
  WHERE status = 'active'
)
UPDATE activities a
SET weight = CASE
  -- All activities except the last get floor(100/cnt) rounded to 2dp
  WHEN r.rn < r.cnt THEN ROUND(100.0 / r.cnt, 2)
  -- Last activity gets the remainder, ensuring the group sums to exactly 100
  ELSE 100.0 - (r.cnt - 1) * ROUND(100.0 / r.cnt, 2)
END
FROM ranked r
WHERE a.id = r.id;

-- ─── Verify ────────────────────────────────────────────────────
-- After running, you can verify with:
-- SELECT user_id, type, SUM(weight) AS total_weight, COUNT(*) AS n_activities
-- FROM activities
-- WHERE status = 'active'
-- GROUP BY user_id, type
-- ORDER BY user_id, type;
-- Each (user_id, type) group should show total_weight = 100.00
