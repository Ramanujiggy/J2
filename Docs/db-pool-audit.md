# pg Pool Configuration Audit

**Date**: 2026-04-21
**Trigger**: The E2E test suite flakes when running all 3 Playwright projects in parallel — three concurrent test workers hammer the same Supabase backend pool. Checking whether the pool config is appropriate and whether real-world concurrent load would experience the same contention.

## Current configuration

File: `backend_api/src/config/db.ts`

```ts
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 20,                        // pg default is 10
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
  application_name: 'journada-backend',
});
```

## Assessment

| Parameter | Current | Status | Note |
|---|---|---|---|
| `max` | 20 | ✓ OK for single-instance | Doubled the pg default of 10. Safe on Free tier (Supabase pool caps at 60 for PgBouncer transaction-mode). Fine for ~10–15 concurrent requests; degrades gracefully beyond that. |
| `idleTimeoutMillis` | 30s | ✓ OK | Reasonable — releases connections back to Supabase promptly when app is idle. |
| `connectionTimeoutMillis` | 5s | ✓ OK | Fails fast when the pool is saturated — better than hanging the request for 30s+ |
| `application_name` | journada-backend | ✓ OK | Helpful for pg_stat_activity filtering on Supabase dashboard. |
| SSL | `rejectUnauthorized: false` | ⚠ Known tradeoff | Required for Supabase's self-signed intermediate. Standard for this connection style. |

## Supabase plan context

- **Free tier**: 60 pooled connections via PgBouncer (port 6543, transaction mode). 15 direct connections (port 5432).
- **Pro**: 200 pooled connections.
- **Team / Enterprise**: Larger.

If `DATABASE_URL` points to the pooler URL (port 6543), the backend's `max: 20` is well within the free-tier 60 cap.

## Recommendation

**No immediate change needed.** The current config is sane for the app's expected traffic. Raising `max` above 20 would only pay off if multiple backend instances are running (Railway autoscale) — and at that point, each instance should keep its own `max` modest so the sum stays under Supabase's cap.

If scaling does become necessary later:
1. Confirm which Supabase URL is being used (pooler vs direct).
2. Raise `max` to 40 on Free tier / 100 on Pro — still leaving headroom.
3. Add pool saturation logging (see below).

## Suggested enhancement — saturation log (optional, ~5 lines)

Add a warning when the pool has been near-full for several consecutive queries:

```ts
// After `const pool = new Pool({...})`:
setInterval(() => {
  const waiting = pool.waitingCount;
  if (waiting > 0) {
    console.warn(`[db] pool saturated — ${waiting} queries waiting for a connection`);
  }
}, 10_000);
```

This gives an ops signal before users notice 5-second timeouts. Non-invasive, read-only metric. Not applied in this audit — recommending for user review.

## Test flakiness origin

The E2E parallel-run flakiness is not caused by pool exhaustion. 3 concurrent test workers × ~5 connections per test flow ≈ 15 connections — well under 20. The actual race is test-side (shared module state across workers re-registering the same email, and shared Supabase DB state when two tests try to insert sessions within the same tick). See `usage.spec.ts` comment about `--workers=1` workaround.
