-- 017: Rich game metadata on canonical_constraints
--
-- Adds a JSONB column to capture the full pedagogical structure of a CLA
-- game: family grouping, your_role (BJJ-specific role taxonomy), start
-- position, continuous and terminal goals for each player, reset condition,
-- difficulty, level, duration, coaching cues, metrics, common errors,
-- safety notes, progression / regression links, source citation, and a
-- `roulette_eligible` flag.
--
-- JSONB chosen over column promotion to keep schema iteration cheap while
-- the field set stabilises. Specific fields can promote to indexed columns
-- later if query patterns demand it.

ALTER TABLE canonical_constraints
    ADD COLUMN IF NOT EXISTS details JSONB;

CREATE INDEX IF NOT EXISTS idx_canonical_constraints_details_role
    ON canonical_constraints USING GIN ((details -> 'your_role'));

CREATE INDEX IF NOT EXISTS idx_canonical_constraints_details_roulette
    ON canonical_constraints ((details ->> 'roulette_eligible'));
