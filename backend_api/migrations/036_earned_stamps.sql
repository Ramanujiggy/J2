-- 036_earned_stamps.sql
--
-- Backs the Boa keepsake-stamp collection. Each row is ONE strike of a die:
--   • manual "Boa" strikes (auto_earned=false) are unconstrained, so re-striking
--     the same die increments the count — the reveal sheet reads count as "Nth time".
--   • system-granted dies (auto_earned=true, e.g. the Eight Gates capstone) may be
--     struck at most once per user, enforced by the partial unique index below, so
--     client-side re-detection can safely POST on every mount without duplicating.
--
-- Purely additive — no existing table is touched.

CREATE TABLE IF NOT EXISTS earned_stamps (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    die_key     TEXT NOT NULL,                  -- stable id from the die catalog (e.g. 'boa', 'eight_gates_26')
    auto_earned BOOLEAN NOT NULL DEFAULT false, -- true for system-granted dies
    struck_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_earned_stamps_user     ON earned_stamps(user_id);
CREATE INDEX IF NOT EXISTS idx_earned_stamps_user_die ON earned_stamps(user_id, die_key);

-- An auto-earned die can be struck at most once per user. Manual strikes
-- (auto_earned=false) are excluded from this constraint, so they accumulate.
CREATE UNIQUE INDEX IF NOT EXISTS uq_earned_stamps_auto
    ON earned_stamps(user_id, die_key) WHERE auto_earned;
