# Implementation Plans

Detailed implementation plans for roadmap objectives. Each entry captures the design rationale, approach, and key decisions so the thought process is preserved when work begins.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## `[ ]` In-App Admin / Troubleshooting View

### Problem

Debugging production issues currently requires opening Railway logs + the Supabase SQL editor to answer questions like "did that migration run?" or "what was the real error?" The catch-all error handler in `app.ts` discards the actual DB error and returns a generic "Server error" to the client, which makes issues very hard to diagnose from the browser alone.

### Approach: In-App View (not an external monitoring service)

External monitoring (Sentry, Datadog) earns its keep when *other people's errors* happen without you watching. For a single-developer app where you're also the primary user, an in-app view has higher leverage: you can check data state, migration status, and error details without leaving the app.

External monitoring can be dropped in later (one-file Sentry SDK install) if there are real users to watch.

### Three Panels

| Panel | What it shows |
|-------|---------------|
| **Health** | DB connection + presence/absence of every expected column in `training_sessions` — the migration-status check we needed when `resonance` was missing |
| **Error Log** | Last 20 server errors in memory: timestamp, route, method, message, stack. No DB write, no external service |
| **Users** | All registered users with session/intention counts; row click shows recent sessions |

### Admin Authentication

No DB column or migration needed. Check: `req.user.email === process.env.ADMIN_EMAIL`.

- Set `ADMIN_EMAIL=you@example.com` in Railway backend env vars
- All admin endpoints 403 if check fails
- Frontend: decode the JWT payload (base64, not encrypted) to read the user's email client-side; gate the `/admin` route without an extra API call

### Files to Change

| File | Change |
|------|--------|
| `backend_api/src/lib/errorLog.ts` | **New** — in-memory ring buffer. `recordError(method, route, err)` + `getRecentErrors()`. Max 20 entries. |
| `backend_api/src/app.ts` | Wire catch-all error handler to call `recordError()`. Also expose the actual `err.message` in the 500 response body (not just "Server error"). |
| `backend_api/src/middleware/adminMiddleware.ts` | **New** — `requireAdmin` middleware, checks email against `ADMIN_EMAIL` env var |
| `backend_api/src/routes/adminRoutes.ts` | **New** — `GET /api/admin/health`, `GET /api/admin/errors`, `GET /api/admin/users` |
| `backend_api/src/controllers/adminController.ts` | **New** — handlers for the 3 admin endpoints |
| `frontend_app/src/context/AuthContext.tsx` | Decode JWT payload to expose `userEmail: string \| null` from context |
| `frontend_app/src/app/AdminPage.tsx` | **New** — three-tab UI, gated to admin email |
| Frontend router | Add `/admin` route, redirect non-admin to `/` |

### Key Implementation Notes

**Error log module** (`src/lib/errorLog.ts`):
```typescript
interface ErrorEntry { ts: string; method: string; route: string; message: string; stack?: string; }
const log: ErrorEntry[] = [];
export function recordError(method: string, route: string, err: unknown) {
  const e = err instanceof Error ? err : new Error(String(err));
  log.unshift({ ts: new Date().toISOString(), method, route, message: e.message, stack: e.stack });
  if (log.length > 20) log.pop();
}
export function getRecentErrors() { return [...log]; }
```

**Health check** — `GET /api/admin/health` — runs `information_schema.columns` query against `training_sessions`, returns each expected column as `{ name, exists }`. Expected columns (15): `id, user_id, date, duration, gi_nogi, intensity, session_type, notes, tags, heading, polarity, sub_skill_tag, script_source, resonance, created_at`.

**Users query** — single SQL with LEFT JOINs to `training_sessions` and `intentions`, grouped by user, returns `session_count` and `intention_count`.

**JWT decode on frontend**:
```typescript
function decodeJwtEmail(token: string): string | null {
  try { return JSON.parse(atob(token.split('.')[1])).email ?? null; }
  catch { return null; }
}
```

### Verification

1. Set `ADMIN_EMAIL` + `VITE_ADMIN_EMAIL` env vars, redeploy
2. Navigate to `/admin` as admin — all three tabs render
3. Health tab: any missing column shows red ✗; add it in Supabase, refresh → green ✓
4. Trigger a 500, check it appears in Errors tab with the real message
5. Non-admin user: `/admin` redirects to `/`
6. `cd backend_api && npm test` — all 42 pass + new tests for admin 403/200

---
