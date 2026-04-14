-- 006: Add missing indexes and database-level enum constraints
-- Performance: training_sessions queries scan full table without user_id index
-- Integrity: enum-like columns rely solely on app-layer validation

-- ── Indexes ──────────────────────────────────────────────────────────────────

-- Critical: every session query filters by user_id
CREATE INDEX IF NOT EXISTS idx_training_sessions_user_id
  ON training_sessions(user_id);

-- Compound: session list queries filter by user + sort by date
CREATE INDEX IF NOT EXISTS idx_training_sessions_user_date
  ON training_sessions(user_id, date DESC);

-- Password reset cleanup queries
CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_user_used
  ON password_reset_tokens(user_id, used);

-- ── Data normalization (fix case inconsistencies before adding constraints) ──

UPDATE users SET belt_rank = LOWER(belt_rank) WHERE belt_rank IS NOT NULL AND belt_rank != LOWER(belt_rank);
UPDATE training_sessions SET gi_nogi = LOWER(gi_nogi) WHERE gi_nogi != LOWER(gi_nogi);
UPDATE training_sessions SET session_type = LOWER(session_type) WHERE session_type != LOWER(session_type);
UPDATE training_sessions SET heading = LOWER(heading) WHERE heading IS NOT NULL AND heading != LOWER(heading);
UPDATE training_sessions SET polarity = LOWER(polarity) WHERE polarity IS NOT NULL AND polarity != LOWER(polarity);
UPDATE training_sessions SET script_source = LOWER(script_source) WHERE script_source IS NOT NULL AND script_source != LOWER(script_source);
UPDATE weekly_intentions SET intent_category = LOWER(intent_category) WHERE intent_category IS NOT NULL AND intent_category != LOWER(intent_category);

-- ── Enum constraints ─────────────────────────────────────────────────────────

-- gi_nogi: only two valid values
DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_gi_nogi CHECK (gi_nogi IN ('gi', 'no_gi'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- session_type: three valid values
DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_session_type CHECK (session_type IN ('class', 'drilling', 'competition_training'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- duration: 1–720 minutes (12 hours max)
DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_duration CHECK (duration >= 1 AND duration <= 720);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- heading: valid pillar values or null
DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_heading CHECK (heading IS NULL OR heading IN ('standup', 'passing', 'pins', 'submissions', 'guard'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- polarity: valid values or null
DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_polarity CHECK (polarity IS NULL OR polarity IN ('offense', 'defense', 'neutral'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- script_source: valid values or null
DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_script_source CHECK (script_source IS NULL OR script_source IN ('directed', 'organic'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- resonance: 1–10 or null
DO $$ BEGIN
  ALTER TABLE training_sessions
    ADD CONSTRAINT check_resonance CHECK (resonance IS NULL OR (resonance >= 1 AND resonance <= 10));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- belt_rank: valid ranks or null
DO $$ BEGIN
  ALTER TABLE users
    ADD CONSTRAINT check_belt_rank CHECK (belt_rank IS NULL OR belt_rank IN ('white', 'blue', 'purple', 'brown', 'black'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- intent_category: valid categories or null
DO $$ BEGIN
  ALTER TABLE weekly_intentions
    ADD CONSTRAINT check_intent_category CHECK (intent_category IS NULL OR intent_category IN ('technical', 'physical', 'mental', 'positional', 'competitive'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
