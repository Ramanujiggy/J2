-- Migration 001: Weekly Intentions
-- Run this in Supabase's SQL editor.

-- 1. Add intent_resonance to existing training_sessions
--    NULL = user did not answer the reflection prompt
--    1 = Off track  |  2 = Tangential  |  3 = On point
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS intent_resonance SMALLINT
  CHECK (intent_resonance IN (1, 2, 3));

-- 2. Create weekly_intentions table
CREATE TABLE IF NOT EXISTS weekly_intentions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start      DATE NOT NULL,  -- ISO Monday (date_trunc('week', date))
  intent_label    TEXT NOT NULL CHECK (char_length(intent_label) <= 20),
  intent_category TEXT CHECK (intent_category IN (
    'technical', 'physical', 'mental', 'positional', 'competitive'
  )),
  created_at      TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, week_start)
);

-- Index for the most common query (user + week lookup)
CREATE INDEX IF NOT EXISTS idx_weekly_intentions_user_week
  ON weekly_intentions(user_id, week_start DESC);
