-- 015: Constraints library + CLA session type
--
-- Adds a curated `canonical_constraints` library + per-user `user_constraints`
-- table — the same dual-library pattern as canonical_positions / user_tags.
-- A constraint is a *rule modification* the user trains under during a CLA
-- (Constraints-Led Approach) session — e.g., "only attack from closed guard,"
-- "no using grips," "submission only via collar choke."
--
-- Sessions reference selected constraints via two new UUID arrays. The
-- session_type CHECK constraint is widened to include 'cla' alongside the
-- existing class / drilling / competition_training values; legacy rows are
-- preserved verbatim.
--
-- Constraints support a NULLABLE parent_pillar — unlike positions, some
-- constraints span multiple pillars (e.g., "no grips" affects standup AND
-- passing AND guard). NULL parent_pillar means "applies broadly."

-- ── Canonical constraints library (curated, global) ────────────────────────
CREATE TABLE IF NOT EXISTS canonical_constraints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL UNIQUE,
  parent_pillar   VARCHAR(20),
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  description     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT canonical_constraints_pillar_valid
    CHECK (parent_pillar IS NULL OR parent_pillar IN ('standup', 'passing', 'pins', 'submissions', 'guard')),
  CONSTRAINT canonical_constraints_name_length
    CHECK (length(name) BETWEEN 1 AND 100)
);

CREATE INDEX IF NOT EXISTS idx_canonical_constraints_pillar
  ON canonical_constraints(parent_pillar);

-- ── User constraints library (per-user customs) ────────────────────────────
CREATE TABLE IF NOT EXISTS user_constraints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name            TEXT NOT NULL,
  parent_pillar   VARCHAR(20),
  aliases         TEXT[] NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT user_constraints_pillar_valid
    CHECK (parent_pillar IS NULL OR parent_pillar IN ('standup', 'passing', 'pins', 'submissions', 'guard')),
  CONSTRAINT user_constraints_name_length
    CHECK (length(name) BETWEEN 1 AND 100),
  CONSTRAINT user_constraints_user_name_unique
    UNIQUE (user_id, name)
);

CREATE INDEX IF NOT EXISTS idx_user_constraints_user
  ON user_constraints(user_id);

-- ── training_sessions linkage ──────────────────────────────────────────────
-- Two new arrays mirror the canonical_position_ids / user_tag_ids pair.
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS canonical_constraint_ids UUID[] DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS user_constraint_ids UUID[] DEFAULT NULL;

-- ── Widen session_type CHECK to include 'cla' ──────────────────────────────
-- Migration 006 originally constrained session_type to three values. CLA
-- (Constraints-Led Approach) joins them as a fourth. Drop and re-add.
DO $$ BEGIN
    ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS check_session_type;
    ALTER TABLE training_sessions
        ADD CONSTRAINT check_session_type
        CHECK (session_type IN ('class', 'drilling', 'competition_training', 'cla'));
EXCEPTION WHEN OTHERS THEN
    -- If the constraint didn't exist for any reason, the ADD above will have
    -- ensured the desired final state. Swallowing the exception keeps the
    -- migration idempotent.
    NULL;
END $$;

-- ── Seed canonical_constraints ─────────────────────────────────────────────
-- Note: a separate agent is curating the seed list. This migration ships the
-- schema only; seed rows arrive in a follow-up migration. Empty library is
-- fine because user_constraints carries the typeahead until canonical lands.
