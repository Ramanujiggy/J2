-- 028: widen_enum_check() helper
--
-- Installs a reusable PL/pgSQL function that captures the defensive
-- "drop every plausible name + re-add canonical" pattern that migrations
-- 024 and 025 had to discover the hard way.
--
-- Background: Postgres / Supabase auto-name CHECK constraints unpredictably.
-- A migration that creates `gi_nogi CHECK (... IN ('gi','no_gi'))` may end up
-- with the constraint named `check_gi_nogi`, `training_sessions_gi_nogi_check`,
-- or `sessions_gi_nogi_check` depending on whether the column was added
-- inline, via ALTER, or recreated. A later "widening" migration that drops
-- only one of those names leaves the old narrow CHECK in force, and INSERTs
-- with the new value get rejected at runtime.
--
-- This helper drops all three plausible names, then re-adds a single
-- canonical constraint named `check_<column>`. Future widenings become a
-- one-line call:
--
--   SELECT widen_enum_check(
--     'training_sessions', 'session_type',
--     ARRAY['class','drilling','competition_training','cla'],
--     false   -- allow_null
--   );
--
-- Idempotent — re-running the same widen_enum_check call is a no-op.
--
-- Limitations (when to fall back to hand-written SQL):
--   • Compound CHECKs (multi-column expressions) — this helper only handles
--     single-column IN-list constraints.
--   • Range checks (e.g. `intensity BETWEEN 1 AND 5`) — use raw ALTER for those.
--   • Cross-table widenings — call the helper once per table.

CREATE OR REPLACE FUNCTION widen_enum_check(
    p_table       TEXT,
    p_column      TEXT,
    p_values      TEXT[],
    p_allow_null  BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
    v_canonical_name  TEXT := 'check_' || p_column;
    v_pg_default_name TEXT := p_table || '_' || p_column || '_check';
    v_short_name      TEXT := p_column || '_check';
    v_values_list     TEXT;
    v_check_expr      TEXT;
BEGIN
    IF array_length(p_values, 1) IS NULL THEN
        RAISE EXCEPTION 'widen_enum_check: p_values must contain at least one value';
    END IF;

    -- Build the IN(...) value list with safe literal quoting.
    SELECT string_agg(quote_literal(v), ', ')
      INTO v_values_list
      FROM unnest(p_values) AS v;

    -- Build the CHECK expression. format() %I quotes identifiers; %s
    -- substitutes the literal-quoted values list we built above.
    IF p_allow_null THEN
        v_check_expr := format('%I IS NULL OR %I IN (%s)',
                               p_column, p_column, v_values_list);
    ELSE
        v_check_expr := format('%I IN (%s)', p_column, v_values_list);
    END IF;

    -- Drop every plausible prior name. IF EXISTS makes each a no-op when
    -- the constraint isn't present, so the caller doesn't need to know
    -- which name(s) the original migration produced.
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
                   p_table, v_canonical_name);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
                   p_table, v_pg_default_name);
    EXECUTE format('ALTER TABLE %I DROP CONSTRAINT IF EXISTS %I',
                   p_table, v_short_name);

    -- Add the canonical constraint. Always uses `check_<column>` so future
    -- widenings find a known name to drop first.
    EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%s)',
                   p_table, v_canonical_name, v_check_expr);
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION widen_enum_check(TEXT, TEXT, TEXT[], BOOLEAN) IS
    'Defensively drop+re-add a single-column enum CHECK constraint. See mig 028.';
