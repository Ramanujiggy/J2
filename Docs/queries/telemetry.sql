-- ============================================================================
-- Chip-input adoption telemetry (migration 013)
-- ============================================================================
--
-- Two questions to answer two weeks after deploy:
--   1. What % of sessions have had_primary = true?  (Double-tap discoverability)
--   2. What % have had_deep_work = true?            (Long-press discoverability)
--
-- Plus: distribution of selection_count to see whether multi-pillar input is
-- actually being used in the wild.
--
-- Decision threshold (per the follow-up plan):
--   pct_primary < 40%  → discoverability problem; affordances need to be louder
--   pct_primary > 70%  → working well
--   between            → monitor
--
-- Run via Railway dashboard or `psql $DATABASE_URL`.
-- Excludes pre-telemetry rows (had_primary IS NULL) — those predate the chips.
-- ============================================================================

SELECT
    COUNT(*)                                                        AS total_sessions,

    COUNT(*) FILTER (WHERE had_primary    = true)                   AS with_primary,
    COUNT(*) FILTER (WHERE had_deep_work  = true)                   AS with_deep_work,

    ROUND(100.0 * COUNT(*) FILTER (WHERE had_primary   = true)
          / NULLIF(COUNT(*), 0), 1)                                 AS pct_primary,
    ROUND(100.0 * COUNT(*) FILTER (WHERE had_deep_work = true)
          / NULLIF(COUNT(*), 0), 1)                                 AS pct_deep_work,

    COUNT(*) FILTER (WHERE selection_count = 1)                     AS one_chip,
    COUNT(*) FILTER (WHERE selection_count = 2)                     AS two_chips,
    COUNT(*) FILTER (WHERE selection_count >= 3)                    AS three_plus_chips
FROM training_sessions
WHERE created_at >= now() - INTERVAL '14 days'
  AND had_primary IS NOT NULL;  -- exclude pre-telemetry rows

-- ----------------------------------------------------------------------------
-- Per-user breakdown — useful if pct_primary is borderline and we want to
-- see whether one power user is skewing the average.
-- ----------------------------------------------------------------------------

-- SELECT
--     user_id,
--     COUNT(*)                                              AS sessions,
--     ROUND(100.0 * COUNT(*) FILTER (WHERE had_primary   = true)
--           / NULLIF(COUNT(*), 0), 1)                       AS pct_primary,
--     ROUND(100.0 * COUNT(*) FILTER (WHERE had_deep_work = true)
--           / NULLIF(COUNT(*), 0), 1)                       AS pct_deep_work
-- FROM training_sessions
-- WHERE created_at >= now() - INTERVAL '14 days'
--   AND had_primary IS NOT NULL
-- GROUP BY user_id
-- ORDER BY sessions DESC;
