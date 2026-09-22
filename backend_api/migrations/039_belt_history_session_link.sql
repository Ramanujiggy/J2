-- A promotion is its own journal entry (its `notes` are the user's words
-- about the day) and, when a class was logged that day, it belongs with
-- that session too. This links the two — the same shape as 037's
-- stamp → session link.
--
-- Nullable: a promotion with no class that day stays unlinked. SET NULL on
-- delete: removing the training entry must never remove the promotion.
--
-- Backfill: link every existing promotion to the earliest session logged on
-- its date. Both sides then auto-link going forward (see beltHistoryModel
-- addEntry and sessionController logSession).

ALTER TABLE belt_history
  ADD COLUMN IF NOT EXISTS session_id UUID REFERENCES training_sessions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_belt_history_session ON belt_history(session_id);

UPDATE belt_history bh
SET session_id = s.id
FROM (
  SELECT DISTINCT ON (user_id, date) id, user_id, date
  FROM training_sessions
  ORDER BY user_id, date, created_at ASC
) s
WHERE bh.session_id IS NULL
  AND s.user_id = bh.user_id
  AND s.date = bh.promoted_at;
