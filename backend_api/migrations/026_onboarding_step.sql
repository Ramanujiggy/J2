-- 026: Onboarding funnel step
--
-- Captures the highest step reached in the first-time guided onboarding flow
-- so we can measure drop-off per step. Pairs with mig 022's binary
-- onboarding_completed_at timestamp — that tells us whether someone finished;
-- this tells us where they bailed.
--
-- Step semantics:
--   0 = not started (registered but never landed on /onboarding/name)
--   1 = welcome splash tapped (mounted /onboarding/name)
--   2 = name saved
--   3 = belt step completed or skipped
--   4 = first session logged via onboarding
--   5 = done page reached → onboarding_completed_at set
--
-- Invariant: onboarding_step never decreases. Backend's setOnboardingStep
-- uses a "$new > onboarding_step" guard so retries / out-of-order calls
-- can't roll a user backward.
--
-- Backfill: existing rows with onboarding_completed_at IS NOT NULL are set
-- to 4 (post-final-step). We can't claim they reached step 5 because that
-- event (the "done page reached" UI moment) wasn't captured pre-migration.
-- Querying completers thus uses `onboarding_step >= 4 AND onboarding_completed_at IS NOT NULL`,
-- not `onboarding_step = 5`. Fresh users starting after this migration
-- progress through 5 cleanly.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_step SMALLINT NOT NULL DEFAULT 0;

UPDATE users
  SET onboarding_step = 4
  WHERE onboarding_completed_at IS NOT NULL
    AND onboarding_step = 0;
