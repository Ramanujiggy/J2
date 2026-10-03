-- 037_stamp_session_id.sql
--
-- Ties a struck stamp to a specific session, so a die (Boa, and future dies)
-- can live ON an entry rather than only in the account-level collection.
--
-- Nullable: account/auto dies that aren't about one session (e.g.
-- eight_gates_26, a consistency milestone) keep session_id NULL. Per-session
-- dies (Boa on an entry, a future 100th-session die) set it. At most one stamp
-- of a given die per session — a re-strike on the same entry is idempotent.
--
-- Purely additive.

ALTER TABLE earned_stamps
    ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES training_sessions(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_earned_stamps_session ON earned_stamps(session_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_earned_stamps_session_die
    ON earned_stamps(session_id, die_key) WHERE session_id IS NOT NULL;
