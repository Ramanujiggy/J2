-- A promotion is a position on the ladder (rank + stripes), and a person
-- can only hold each position once. Before this, every "Tie it on" inserted
-- a fresh row, so re-tying the same position stacked duplicates.
--
-- 1. Collapse existing duplicates: for each (user, rank, stripes) keep the
--    most recently created row — the latest tie-on is the user's last word
--    on the date.
-- 2. Enforce one row per position from here on. The model upserts on it.

DELETE FROM belt_history bh
USING belt_history newer
WHERE bh.user_id   = newer.user_id
  AND bh.belt_rank = newer.belt_rank
  AND bh.stripes   = newer.stripes
  AND (newer.created_at > bh.created_at
       OR (newer.created_at = bh.created_at AND newer.id > bh.id));

ALTER TABLE belt_history
  ADD CONSTRAINT belt_history_user_position_key UNIQUE (user_id, belt_rank, stripes);
