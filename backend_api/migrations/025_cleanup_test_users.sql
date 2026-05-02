-- 025: Cleanup accumulated test users.
--
-- Background: every Playwright spec used to call freshEmail() which
-- generated a brand-new email per run (csv-{project}-{ts}{rand}
-- @journada-e2e.com, interaction-{ts}@journada-e2e.com, etc.). Across
-- many runs that pattern accumulated to ~140 user rows in production.
-- Migration 023 introduced support_cases / admin dashboard; once we
-- could see the count, we consolidated to a single shared persistent
-- test account (e2e@journada-e2e.com) — see e2e/test-account.ts. This
-- migration removes the legacy accumulation.
--
-- Patterns matched (delete):
--   - csv-%@journada-e2e.com         (csv-import-modal spec accumulators)
--   - interaction-%@journada-e2e.com (interaction spec accumulators)
--   - %-%@journada-e2e.com           (generic stamped pattern)
--   - %@example.com                  (placeholder emails)
--
-- Explicitly preserved:
--   - e2e@journada-e2e.com           (the new persistent test account)
--   - robertdgelin@gmail.com         (founder, granted admin in mig 024)
--
-- Idempotent: re-running deletes nothing once cleanup has happened.
-- Cascading FKs (training_sessions, weekly_intentions, user_tags,
-- support_cases, etc. all ON DELETE CASCADE) clean up orphan rows.

DELETE FROM users
WHERE
  email != 'e2e@journada-e2e.com'
  AND email != 'robertdgelin@gmail.com'
  AND (
       email LIKE '%@journada-e2e.com'
    OR email LIKE '%@example.com'
  );
