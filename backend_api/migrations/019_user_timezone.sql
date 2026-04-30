-- 019: User timezone
--
-- IANA timezone string per user (e.g. "America/Los_Angeles", "Asia/Tokyo").
-- Required for the class-schedule notification scheduler to convert
-- server-side UTC ticks into the user's local clock when matching against
-- their `class_schedules.start_time`. Default 'UTC' so existing rows stay
-- valid; the frontend syncs the real value via PATCH /api/users/me/timezone
-- on first load using `Intl.DateTimeFormat().resolvedOptions().timeZone`.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS timezone VARCHAR(64) NOT NULL DEFAULT 'UTC';
