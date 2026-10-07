-- 043: Notification send ledger
--
-- Renumbered from 027 (that number was used twice; see RENAMED_MIGRATIONS in
-- src/app.ts). No migration reads notification_sends, and the scheduler only
-- touches it at runtime, so applying it later is equivalent.
--
-- Logs every web-push send attempt — success, gone (410/404), or other error
-- — so the scheduler is observable without ad-hoc DB queries. Answers the
-- "is the cron working today?" question with a single grouped count per
-- 24-hour window.
--
-- One row per send attempt (i.e. one row per subscription per fire). A class
-- reminder for a user with 3 active devices produces 3 rows.
--
-- status enum:
--   'sent'         — webpush returned 2xx
--   'gone'         — 410/404, subscription was expired and has been deleted
--   'client_error' — other 4xx (rare; usually malformed payload)
--   'server_error' — 5xx (push service outage)
--   'no_vapid'     — VAPID keys not configured at send time (deploy issue)
--
-- subscription_id is NULLABLE because 'gone' rows are written *before*
-- subscription deletion completes; we still want the FK off if we choose to
-- clean it up later. Use ON DELETE SET NULL so subscription churn doesn't
-- delete history.

CREATE TABLE IF NOT EXISTS notification_sends (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subscription_id UUID REFERENCES push_subscriptions(id) ON DELETE SET NULL,
  category        TEXT NOT NULL,
  status          TEXT NOT NULL,
  status_code     INTEGER,
  error_message   TEXT,
  endpoint_host   TEXT,
  schedule_id     UUID,
  sent_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT notification_sends_status_chk
    CHECK (status IN ('sent','gone','client_error','server_error','no_vapid')),
  CONSTRAINT notification_sends_category_chk
    CHECK (category IN ('pre_class','intention_check','drive_home_log'))
);

-- Hot query: "what fired in the last 24h, grouped by status?" — supports the
-- scheduler-health dashboard and on-demand triage.
CREATE INDEX IF NOT EXISTS notification_sends_sent_at_idx
  ON notification_sends (sent_at DESC);

-- Per-user history (e.g. "did Alice get her last 3 reminders?")
CREATE INDEX IF NOT EXISTS notification_sends_user_idx
  ON notification_sends (user_id, sent_at DESC);
