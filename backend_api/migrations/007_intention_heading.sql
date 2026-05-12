-- 007: Add heading column to weekly_intentions
-- Links intentions directly to Prism vertices for reliable alignment computation.
-- Replaces the brittle word-matching alignment logic with heading === heading.

ALTER TABLE weekly_intentions ADD COLUMN IF NOT EXISTS heading VARCHAR(20) DEFAULT NULL;

-- Constraint: same valid values as training_sessions.heading
DO $$ BEGIN
  ALTER TABLE weekly_intentions
    ADD CONSTRAINT check_intention_heading CHECK (heading IS NULL OR heading IN ('standup', 'passing', 'pins', 'submissions', 'guard'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
