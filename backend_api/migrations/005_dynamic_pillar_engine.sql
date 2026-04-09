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
ALTER TABLE training_sessions
  RENAME COLUMN intent_resonance TO resonance;
