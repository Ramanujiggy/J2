-- 022: Onboarding completion timestamp
--
-- NULL = user has not completed the first-time onboarding flow yet
-- (a real timestamp = onboarded). The frontend reads this from the
-- profile endpoint and routes new users into /onboarding/* until they
-- finish the guided flow. POST /api/profile/onboarding-complete sets
-- the timestamp to NOW().
--
-- Existing users (anyone who registered pre-migration) are backfilled to
-- NOW() so they don't get force-routed into onboarding on next visit —
-- they've already self-onboarded by exploring the app.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS onboarding_completed_at TIMESTAMPTZ;

UPDATE users
  SET onboarding_completed_at = NOW()
  WHERE onboarding_completed_at IS NULL;
