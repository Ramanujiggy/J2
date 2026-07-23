-- 021: Push subscriptions
--
-- Stores Web Push subscription objects (endpoint + p256dh + auth) per device
-- per user. A user with the PWA installed on iPhone + iPad gets two rows.
-- The endpoint is unique per browser-device install, which is what we use
-- as the upsert key.
--
-- Per-category opt-in flags follow the Headspace pre-permission pattern:
-- the user picks which kinds of pings they want before the OS dialog fires,
-- and can flip them off later without losing the subscription itself.

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  endpoint        TEXT NOT NULL UNIQUE,
  p256dh          TEXT NOT NULL,
  auth            TEXT NOT NULL,
  user_agent      TEXT,
  pre_class       BOOLEAN NOT NULL DEFAULT true,
  intention_check BOOLEAN NOT NULL DEFAULT true,
  drive_home_log  BOOLEAN NOT NULL DEFAULT true,
  last_seen       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS push_subscriptions_user_idx ON push_subscriptions(user_id);
