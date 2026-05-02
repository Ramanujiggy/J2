# Database Default / CHECK Constraint Drift Audit

**Date**: 2026-04-21
**Trigger**: After migration 011 fixed the `users.belt_rank` drift that was silently blocking all new user registrations, we audited every column in the `public` schema to see if any other column had the same class of bug — a literal `DEFAULT` value that isn't in the column's `CHECK` constraint allowlist.

## Method

Read-only query against `information_schema.columns` + `information_schema.check_constraints`, then cross-reference in memory. Script lived at `backend_api/audit-db-drift.mjs` during the audit (removed after). Heuristic handles both `col IN (...)` and `col = ANY (ARRAY[...])` patterns.

## Result

**Clean.** Zero drift detected across all 25 columns with DEFAULT values and all 50+ CHECK constraints.

## Columns cross-checked

Columns whose `DEFAULT` was verified against a literal allowlist `CHECK`:

| Table | Column | Default | CHECK allows | Status |
|---|---|---|---|---|
| `training_sessions` | `gi_nogi` | `'gi'` | `'gi', 'no_gi'` | ✓ |
| `training_sessions` | `session_type` | `'class'` | `'class', 'drilling', 'competition_training'` | ✓ |
| `training_sessions` | `intensity` | `3` | range 1–5 | ✓ |
| `weekly_intentions` | `duration_days` | `7` | range 1–30 | ✓ |
| `weekly_intentions` | `heading` | `NULL` | NULL or pillar | ✓ |
| `users` | `intentions_enabled` | `true` | (no CHECK, bool) | ✓ |
| `users` | `stripes` | `0` | (no CHECK on value) | ✓ |
| `users` | `belt_rank` | (no default) | NULL or valid rank | ✓ after migration 011 |

## No action required

If a future migration adds a new `CHECK` to an existing column, re-run the audit. Script is easy to recreate:

```sql
-- List defaults
SELECT table_name, column_name, column_default
FROM information_schema.columns
WHERE table_schema = 'public' AND column_default IS NOT NULL;

-- List CHECK constraints
SELECT tc.table_name, cc.check_clause
FROM information_schema.table_constraints tc
JOIN information_schema.check_constraints cc ON tc.constraint_name = cc.constraint_name
WHERE tc.table_schema = 'public' AND tc.constraint_type = 'CHECK';
```

Cross-reference manually — the set is small enough.
