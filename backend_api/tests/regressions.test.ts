// Regression tests — these are *real-DB integration tests* that catch the
// specific bug class that hit production this session: CHECK constraint
// regressions that pass mocked tests but fail at INSERT time against
// actual Postgres.
//
// Gated on `TEST_DATABASE_URL`. If the env var isn't set (e.g. CI without
// a test DB), the suite is skipped — not failed — so the rest of the
// mocked tests still pass on dev machines without test infrastructure.
//
// To run locally:
//   1. Spin up a fresh Supabase project (free tier) or use any disposable
//      Postgres instance.
//   2. Add `TEST_DATABASE_URL=postgresql://...` to a `.env.test` file.
//   3. Run `npm test` — the regressions suite will detect the env var,
//      run all migrations against the test DB, then exercise the bug
//      patterns end-to-end.
//
// Each test creates a fresh user (unique email by timestamp) and cleans up
// its own rows on tearDown. No shared state between tests.
//
// Bug history these tests guard against:
//   • mig 024 — CLA session_type rejected by an auto-named CHECK constraint
//     that survived migration 015's named widening. Test #1 below.
//   • mig 025 — gi_nogi='both' rejected by a similar auto-named CHECK that
//     survived migration 006's original definition. Test #2 below.

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { Pool } from 'pg';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

// Load .env.test if present so TEST_DATABASE_URL can live there.
dotenv.config({ path: '.env.test' });

const TEST_DB_URL = process.env.TEST_DATABASE_URL;

// IMPORTANT — production-DB safety guard.
//
// Naively comparing `TEST_DATABASE_URL` against `process.env.DATABASE_URL`
// is unsafe: vitest.config.ts injects a fake `postgresql://test:test@.../test`
// value into `process.env.DATABASE_URL` BEFORE this file loads, which means
// the guard would compare the user's TEST URL against the fake injected URL
// instead of the user's REAL prod URL. If the user's `.env.test` accidentally
// holds their actual prod connection string, the guard would let destructive
// INSERTs run against prod.
//
// Fix: read the prod URL directly from the `.env` file on disk (bypassing
// the dotenv-loaded + vitest-overridden `process.env`). That captures the
// user's actual prod connection string and gives the guard real teeth.
function readEnvFileVar(filePath: string, name: string): string | undefined {
  if (!fs.existsSync(filePath)) return undefined;
  const contents = fs.readFileSync(filePath, 'utf-8');
  const match = contents.match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'));
  if (!match) return undefined;
  // Strip optional surrounding quotes + trailing whitespace
  return match[1]!.trim().replace(/^["']|["']$/g, '');
}

const ENV_FILE_PROD_DB_URL = readEnvFileVar('.env', 'DATABASE_URL');
const ENV_FILE_TEST_DB_URL = readEnvFileVar('.env.test', 'TEST_DATABASE_URL');

const isSafeToRun =
  Boolean(TEST_DB_URL) &&
  // Guard against the vitest-fake-URL false negative: ALSO compare against
  // the prod URL straight from .env (not process.env, which vitest overrides).
  TEST_DB_URL !== ENV_FILE_PROD_DB_URL &&
  // Belt-and-suspenders: catch the case where TEST_DATABASE_URL was set in
  // the shell (not .env.test) but somehow matches the .env's prod URL.
  ENV_FILE_TEST_DB_URL !== ENV_FILE_PROD_DB_URL;

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

// `describe.skip` vs `describe` chosen at module-load based on env. Vitest
// reports the suite as "skipped" so the user can see it isn't running.
const describeRegressions = isSafeToRun ? describe : describe.skip;

let pool: Pool;

async function applyMigrations(p: Pool) {
  // Mirrors the runMigrations() flow in app.ts — apply every numbered .sql
  // file in order. Idempotent (each migration uses IF NOT EXISTS / DROP IF
  // EXISTS patterns) so re-running against an already-migrated test DB is
  // safe.
  await p.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) return;

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  const applied = await p.query('SELECT name FROM schema_migrations');
  const appliedSet = new Set<string>(applied.rows.map((r: { name: string }) => r.name));

  for (const file of files) {
    if (appliedSet.has(file)) continue;
    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
    await p.query(sql);
    await p.query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [file]);
  }
}

async function createTestUser(p: Pool): Promise<string> {
  const email = `regression-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@test.local`;
  const result = await p.query(
    `INSERT INTO users (email, password_hash) VALUES ($1, $2) RETURNING id`,
    [email, '$2b$12$placeholder_hash_for_test_user_only_no_real_login'],
  );
  return result.rows[0].id;
}

async function cleanupUser(p: Pool, userId: string) {
  // FK CASCADE on most tables handles cleanup; users last.
  await p.query('DELETE FROM users WHERE id = $1', [userId]);
}

describeRegressions('Regression tests (real-DB, mig 024 + 025)', () => {
  beforeAll(async () => {
    pool = new Pool({
      connectionString: TEST_DB_URL,
      ssl: { rejectUnauthorized: false },
      max: 4,
    });
    await applyMigrations(pool);
  }, 60_000);

  afterAll(async () => {
    if (pool) await pool.end();
  });

  // ── mig 024 — CLA session_type CHECK constraint regression ────────────────
  it('inserts a CLA session without violating the session_type CHECK (mig 024)', async () => {
    const userId = await createTestUser(pool);
    try {
      const result = await pool.query(
        `INSERT INTO training_sessions
           (user_id, date, duration, gi_nogi, intensity, session_type, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, session_type`,
        [userId, '2026-05-04', 60, 'gi', 3, 'cla', ['guard']],
      );
      expect(result.rows[0].session_type).toBe('cla');
    } finally {
      await cleanupUser(pool, userId);
    }
  }, 30_000);

  // ── mig 025 — gi_nogi='both' CHECK constraint regression ──────────────────
  it("inserts a session with gi_nogi='both' without violating the gi_nogi CHECK (mig 025)", async () => {
    const userId = await createTestUser(pool);
    try {
      const result = await pool.query(
        `INSERT INTO training_sessions
           (user_id, date, duration, gi_nogi, intensity, session_type, tags)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, gi_nogi`,
        [userId, '2026-05-04', 90, 'both', 4, 'class', ['passing']],
      );
      expect(result.rows[0].gi_nogi).toBe('both');
    } finally {
      await cleanupUser(pool, userId);
    }
  }, 30_000);

  // ── mig 025 — class_schedules.gi_nogi='both' regression ──────────────────
  it("inserts a class schedule with gi_nogi='both' (mig 025)", async () => {
    const userId = await createTestUser(pool);
    try {
      const result = await pool.query(
        `INSERT INTO class_schedules
           (user_id, name, day_of_week, start_time, duration_min, gi_nogi)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, gi_nogi`,
        [userId, 'Open Mat', 6, '11:00:00', 90, 'both'],
      );
      expect(result.rows[0].gi_nogi).toBe('both');
    } finally {
      await cleanupUser(pool, userId);
    }
  }, 30_000);
});

// Visibility log when the suite skips. Vitest's "skipped" reporter is
// quiet by default; this makes the reason explicit so the user knows
// they need to set TEST_DATABASE_URL to enable real-DB regression coverage.
if (!isSafeToRun) {
  if (!TEST_DB_URL) {
    // eslint-disable-next-line no-console
    console.log('ℹ️  regressions.test.ts skipped — set TEST_DATABASE_URL in .env.test to enable real-DB regression tests.');
  } else if (TEST_DB_URL === ENV_FILE_PROD_DB_URL || ENV_FILE_TEST_DB_URL === ENV_FILE_PROD_DB_URL) {
    // eslint-disable-next-line no-console
    console.warn('⚠️  regressions.test.ts skipped — TEST_DATABASE_URL matches the DATABASE_URL in .env. Refusing to run destructive tests against the production DB.');
  } else {
    // eslint-disable-next-line no-console
    console.warn('⚠️  regressions.test.ts skipped — TEST_DATABASE_URL safety guard tripped.');
  }
}
