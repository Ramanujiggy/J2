-- 027: Technique Library v1 — affinity + cumulative resonance journal.
--
-- Both columns hang off `user_tags` (the `canonical_positions` library is
-- shared/read-only; affinity and resonance are inherently personal data).
-- Every canonical position the user picks is silently forked into a
-- `user_tags` row before any personal data attaches to it — see the new
-- `POST /api/user-tags/promote-canonical` endpoint.
--
-- Step semantics for `affinity`:
--   NULL       — default, no opinion yet
--   'go_to'    — ★ "this works for me"  (highlighted in pickers + library)
--   'learning' — ◐ "I'm working on it"
--   'shelved'  — ◌ "tried, not for me / not now"
--
-- `resonance_journal` is a single cumulative TEXT column — one narrative
-- per move that grows over time. Distinct from `video_notes` ("how to do
-- the move", from migration 010) and from session `notes` (per-session
-- prose). The brand framing: lab notebook (existing structured fields)
-- plus memory book (this column).
--
-- Both columns are nullable + additive; no backfill needed.

ALTER TABLE user_tags
  ADD COLUMN IF NOT EXISTS affinity VARCHAR(20)
    CHECK (affinity IS NULL OR affinity IN ('go_to', 'learning', 'shelved'));

ALTER TABLE user_tags
  ADD COLUMN IF NOT EXISTS resonance_journal TEXT
    CHECK (resonance_journal IS NULL OR length(resonance_journal) <= 5000);

-- Partial index for the library page's affinity filter chip.
-- Most rows will be affinity IS NULL, so a partial index keeps the
-- index tiny while still answering "show me my go-to moves" fast.
CREATE INDEX IF NOT EXISTS idx_user_tags_affinity
  ON user_tags (user_id, affinity)
  WHERE affinity IS NOT NULL;
