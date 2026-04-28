-- 016: Session partners (freetext)
--
-- Captures who the user trained with on a given session. Freetext array of
-- names today (e.g. {"Alex", "Mav", "the new white belt"}); will graduate to
-- a structured user_partners table when the Journada 2.0 social layer
-- arrives. Five-cap is enforced at the controller layer so we can lift the
-- cap without a schema change later.

ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS partners TEXT[] DEFAULT NULL;
