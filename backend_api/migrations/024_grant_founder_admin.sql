-- 024: Grant admin to founder
--
-- One-time seed migration that flips users.is_admin = true for the founder's
-- account. Idempotent — re-running is a no-op (WHERE matches exactly one
-- row; SET value already matches if the migration has run before, or if
-- someone manually set the flag via direct UPDATE).
--
-- The general grant pattern is documented in Docs/database.md (mig 023):
--   UPDATE users SET is_admin = true WHERE email = '<your-email>';
--
-- This migration just performs that one-time grant for robertdgelin@gmail.com
-- so the admin can navigate to /admin from the profile page without an
-- out-of-band SQL step.

UPDATE users SET is_admin = true WHERE email = 'robertdgelin@gmail.com';
