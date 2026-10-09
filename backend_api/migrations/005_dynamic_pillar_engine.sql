-- Migration 005: Dynamic Pillar Engine
-- Renames pillar tag values, adds session-level intent columns,
-- and renames intent_resonance → resonance (scale 1–10).

-- ── Rename tag values in-place ────────────────────────────────────────────────
UPDATE training_sessions SET tags = array_replace(tags, 'guard_retention', 'guard');
UPDATE training_sessions SET tags = array_replace(tags, 'pin_escapes',     'pins');
UPDATE training_sessions SET tags = array_replace(tags, 'guard_passing',   'passing');

-- ── Add new intent/telemetry columns (all nullable) ───────────────────────────
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS heading       varchar(20),
  ADD COLUMN IF NOT EXISTS polarity      varchar(10),
  ADD COLUMN IF NOT EXISTS sub_skill_tag text,
  ADD COLUMN IF NOT EXISTS script_source varchar(10);

-- ── Rename intent_resonance (1–3, unused) → resonance (1–10) ─────────────────
-- Idempotent: a from-scratch apply gets `resonance` directly from migration 000,
-- so a bare RENAME would fail with 42701 (column already exists). Converge both
-- paths — legacy incremental DBs and clean installs — to a single `resonance`.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'training_sessions' AND column_name = 'intent_resonance'
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'training_sessions' AND column_name = 'resonance'
    ) THEN
      -- Both columns present (000 created `resonance`, 001 added `intent_resonance`):
      -- drop the redundant legacy column rather than rename onto an occupied name.
      ALTER TABLE training_sessions DROP COLUMN intent_resonance;
    ELSE
      -- Legacy path: only the old column exists — rename it into place.
      ALTER TABLE training_sessions RENAME COLUMN intent_resonance TO resonance;
    END IF;
  END IF;
  -- intent_resonance absent → already consolidated; nothing to do.
END $$;
