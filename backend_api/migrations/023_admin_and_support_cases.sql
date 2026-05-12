-- 023: Admin flag + support cases
--
-- Adds an is_admin column to users (defaults false; granted manually via
-- direct UPDATE) and creates the support_cases table that backs the
-- admin dashboard's case queue. Any authed user can submit a case via
-- POST /api/cases; only admins read / mutate via /api/admin/cases.
--
-- The auto-context fields (page_url, user_agent, app_version) are captured
-- silently by the client at submit time so the user only types subject +
-- description while the admin gets full debug context.

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_admin BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS support_cases (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) NOT NULL DEFAULT 'open'
                  CHECK (status IN ('open', 'in_progress', 'closed')),
  severity     VARCHAR(20) NOT NULL DEFAULT 'normal'
                  CHECK (severity IN ('low', 'normal', 'high', 'urgent')),
  subject      VARCHAR(200) NOT NULL,
  description  TEXT NOT NULL,
  page_url     TEXT,
  user_agent   TEXT,
  app_version  VARCHAR(40),
  admin_notes  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at    TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS support_cases_user_id_idx    ON support_cases(user_id);
CREATE INDEX IF NOT EXISTS support_cases_status_idx     ON support_cases(status);
CREATE INDEX IF NOT EXISTS support_cases_created_at_idx ON support_cases(created_at DESC);

-- Manual one-time grant (run after deploy):
-- UPDATE users SET is_admin = true WHERE email = 'robertdgelin@gmail.com';
