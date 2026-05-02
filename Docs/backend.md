# Backend Reference

Root: `project/J2/backend_api/`

---

## Directory Structure

```
backend_api/
├── migrations/
│   ├── 001_add_weekly_intentions.sql
│   ├── 002_add_intention_duration.sql
│   ├── 003_add_journal_entry.sql
│   ├── 004_add_intentions_enabled.sql
│   └── 005_dynamic_pillar_engine.sql
├── tests/
│   ├── auth.test.ts
│   ├── sessions.test.ts
│   └── middleware.test.ts
└── src/
    ├── app.ts                         ← Express entry point + auto-migrations
    ├── server.ts                      ← HTTP server startup + listen
    ├── config/
    │   └── db.ts                      ← pg pool + smoke test
    ├── controllers/
    │   ├── authcontroller.ts
    │   ├── sessionController.ts
    │   ├── profileController.ts
    │   ├── intentionController.ts
    │   ├── userTagController.ts        ← user_tags CRUD (migration 008)
    │   └── canonicalPositionController.ts  ← read-only canonical library (migration 012)
    ├── middleware/
    │   └── authMiddleware.ts
    ├── models/
    │   ├── userModel.ts
    │   ├── sessionModel.ts
    │   ├── profileModel.ts
    │   ├── intentionModel.ts
    │   ├── userTagModel.ts             ← user_tags CRUD (migration 008)
    │   ├── canonicalPositionModel.ts   ← canonical_positions queries (migration 012)
    │   └── passwordResetModel.ts
    ├── routes/
    │   ├── authRoutes.ts
    │   ├── sessionRoutes.ts
    │   ├── profileRoutes.ts
    │   ├── intentionRoutes.ts
    │   ├── userTagRoutes.ts            ← /api/user-tags (migration 008)
    │   └── canonicalPositionRoutes.ts  ← /api/canonical-positions (migration 012)
    └── services/
        └── emailService.ts            ← Nodemailer SMTP (Resend / Ethereal fallback)
```

---

## Entry Points — `src/server.ts` + `src/app.ts`

**`src/server.ts`** — HTTP server startup. Imports `app` and `runMigrations` from `app.ts`, calls `app.listen(PORT)`, then runs auto-migrations.

**`src/app.ts`** — Express app setup:
- `helmet()` — secure HTTP headers
- `cors()` — CORS locked to `ALLOWED_ORIGIN` env var in production; defaults to `*` (open) in dev
- `express.json()` — JSON body parser
- Route mounting: `/auth`, `/api/sessions`, `/api/profile`, `/api/intentions`, `/api/user-tags`, `/api/canonical-positions`
- Health check at `GET /` — runs `SELECT 1` smoke test
- Auto-migration on startup: creates `password_reset_tokens` table + indexes if not present
- Validates required env vars (`DATABASE_URL`, `JWT_SECRET`) on startup — exits if missing
- Catch-all error handler for Express 5 async errors

---

## Database Config — `src/config/db.ts`

- Loads `.env` with `dotenv.config()`
- **DATE type parser override:** `pg.types.setTypeParser(types.builtins.DATE, v => v)` registered at module load. Forces every PostgreSQL `DATE` column to come back as a raw `YYYY-MM-DD` string instead of node-postgres' default JS `Date` object. This matches the `string`-typed contracts used across all models and controllers (e.g. `week_start.slice(0, 10)` calls in `intentionController.createIntention` mid-week pivot logic, `r.date.slice(0, 10)` in CSV-import duplicate detection in `sessionController`). Originally added to fix a runtime crash on the "Set Focus" button when an existing intention triggered the pivot path.
- Creates `pg.Pool` using `DATABASE_URL`
- SSL: `rejectUnauthorized: false` (required for Supabase)
- Runs `SELECT NOW()` smoke test on startup; exits with `-1` on failure
- Exports `query(text, params)` helper used by all models

---

## Middleware

### `authMiddleware.ts` — `verifyToken`

1. Extracts `Authorization: Bearer <token>` header — 401 if missing
2. Verifies using `JWT_SECRET` env var
3. Attaches `{id, email}` to `req.user`
4. Specific error handling:
   - `TokenExpiredError` → 401 "Token expired. Please log in again."
   - `JsonWebTokenError` → 401 "Invalid token."
   - Other → 500

Applied to all `/api/*` routes.

---

## Controllers

### `authController.ts`

**`register(req, res)`**
1. Validates email + password present
2. Normalises email: `.toLowerCase().trim()`
3. Checks for existing user (409 if found)
4. Hashes password with bcrypt (12 rounds)
5. Calls `createUser()` → returns `{id, email}`
6. Returns 201

**`login(req, res)`**
1. Validates email + password present
2. Normalises email: `.toLowerCase().trim()`
3. Looks up user by email → 401 if not found (generic message — no email enumeration)
4. `bcrypt.compare()` → 401 if mismatch
5. Signs JWT with `{id, email}`, expires `24h`
6. Returns 200 with token

**`requestPasswordReset(req, res)`**
1. Accepts `{ email }` — normalises to lowercase
2. Always returns 200 regardless of whether email exists (enumeration-safe)
3. If user found: creates 1-hour token via `createPasswordResetToken()`, sends email via `emailService.sendPasswordResetEmail()`

**`resetPassword(req, res)`**
1. Accepts `{ token, newPassword }`
2. Looks up token via `findValidPasswordResetToken()` — 400 if not found, expired, or already used
3. Hashes new password with bcrypt (12 rounds)
4. Calls `updatePasswordHash()` to persist
5. Marks token used via `markTokenUsed()`
6. Returns 200

---

### `sessionController.ts`

**`logSession(req, res)`**
1. Validates required fields: `date`, `duration`, `gi_nogi`, `intensity`, `session_type`
2. Validates `gi_nogi` ∈ `{gi, no_gi}`
3. Validates `session_type` ∈ `{class, drilling, competition_training}`
4. Validates `heading` if provided: must be in `VALID_TAGS` (`standup`, `passing`, `pins`, `submissions`, `guard`)
5. Validates `tags`: if provided must be array from `VALID_TAGS`; if omitted, auto-derived as `[heading]`; requires ≥ 1 valid tag after derivation
6. Validates `polarity` if provided: must be in `VALID_POLARITIES` (`offense`, `defense`, `neutral`)
7. Validates `script_source` if provided: must be in `VALID_SOURCES` (`directed`, `organic`)
8. Sanitizes `user_tag_ids`, `canonical_position_ids`, and `pillar_distribution` (see helpers below)
9. Calls `createSession()` → 201

Constants: `VALID_TAGS = new Set(['standup', 'passing', 'pins', 'submissions', 'guard'])`, `VALID_POLARITIES`, `VALID_SOURCES`

**Sanitisation helpers:**
- `sanitizeUserTagIds(userId, raw)` — UUID-shape filter, dedupe, ownership check via `getUserTagsByIds`. Drops orphan/foreign IDs silently (never 400).
- `sanitizeCanonicalPositionIds(raw)` — UUID-shape filter, dedupe, existence check via `filterExistingCanonicalIds` (canonicalPositionModel). Same silent-drop policy. Added in migration 012.
- `sanitizePillarDistribution(raw)` — drops invalid pillar keys + values outside [0,1], filters zero-weights, renormalises remaining keys to sum exactly 1.0. **Muted vertices** from the Prism arrive without their key in the JSONB; renormalisation produces a clean distribution across only the active pillars.

**`getSessions(req, res)`**
- Parses optional `?from` and `?to` query params; validates each against `YYYY-MM-DD` regex if present (400 on invalid)
- Calls `getSessionsByUser(userId, from?, to?)` → returns array ordered date DESC

**`searchSessionsHandler(req, res)`** (GET `/api/sessions/search`)
- Accepts query params: `from`, `to`, `gi_nogi`, `heading`, `polarity`, `intensity`, `session_type`, `user_tag_id`, `text`, `limit`, `offset`
- Delegates filtering to `sessionModel.searchSessions(userId, filter)` (builds dynamic WHERE clause)
- Returns `{ sessions: SessionSummary[], total: number }` for paginated display

**`updateSession(req, res)`**
1. Validates same fields as create (including new Dynamic Pillar fields and `user_tag_ids`)
2. Calls `updateSession(id, userId, ...)` with ownership check
3. Returns 404 if not found or not owned

**`deleteSession(req, res)`**
1. Extracts `id` from route params
2. Calls `deleteSession(id, userId)` — ownership enforced in SQL (`WHERE id = $1 AND user_id = $2`)
3. Returns 404 if not found or not owned; 200 on success

**`importSessions(req, res)`**
1. Accepts `{ sessions: SessionRow[] }` — array of up to 500 pre-validated session objects
2. Calls `bulkInsertSessions(userId, sessions)` — transactional; rolls back on any row failure
3. Returns 201 with `{ imported: N }`
4. Returns 400 if payload is not an array or exceeds 500 rows

---

### `profileController.ts`

**`fetchProfile(req, res)`**
- Calls `getProfile(userId)` → returns profile or `null`

**`saveProfile(req, res)`**
1. Zod schema validates and strips unknown fields
2. Merges incoming data with existing profile (missing fields keep current values)
3. Calls `updateProfile(userId, mergedData)` → 200

**Zod schema rules:**
- `name`: string max 100, nullable, optional
- `belt_rank`: enum or null, optional
- `stripes`: int 0–4, optional
- `home_gym_name/address/place_id`: strings with max lengths, nullable, optional
- `intentions_enabled`: boolean, optional

---

### `intentionController.ts`

**Helper: `getWeekStart(date: Date): string`**
Returns the ISO Monday (YYYY-MM-DD) for any given date. Used to normalise `week_start`.

**`createIntention(req, res)`**
1. Validates `intent_label` (required, ≤20 chars)
2. Validates `intent_category` if provided (must be valid enum)
3. Validates `duration_days` if provided (1–30)
4. Computes `week_start` from request or current UTC date
5. Calls `getIntentionByWeek()` — returns 409 if an intention already exists for that week
6. Calls `createIntention()` to insert

**`getIntentions(req, res)`**
- Returns all intentions for user, week_start DESC

**`getCurrentIntention(req, res)`**
- Accepts optional `?week_start=YYYY-MM-DD` query param
- Defaults to ISO Monday of today
- Calls `getIntentionByWeek()` → returns intention or `null`

**`deleteIntention(req, res)`**
- Calls `deleteIntention(userId, id)` with ownership check
- Returns 404 if not found or not owned

**`patchJournalEntry(req, res)`**
- Validates `journal_entry` is a string
- Calls `updateJournalEntry(userId, id, journalEntry)` with ownership check
- Returns 404 if not found or not owned

---

### `userTagController.ts`

**`getUserTags(req, res)`**
- Returns `{ tags: UserTag[] }` owned by the authenticated user
- Delegates to `userTagModel.getUserTags(userId)`

**`createUserTag(req, res)`**
- Validates `name` (1–50 chars) and `parent_pillar` (valid pillar)
- Atomic idempotent upsert via `userTagModel.upsertUserTag()` — single SQL statement with `ON CONFLICT (user_id, name) DO UPDATE` so concurrent calls can't race
- Returns 201 if a new row was inserted, 200 if an existing row was returned (`created` boolean from upsert distinguishes)

**`updateUserTag(req, res)`**
- Validates optional `name` and `parent_pillar`
- Calls `userTagModel.updateUserTag(userId, id, ...)` with ownership check

**`updateUserTagVideo(req, res)`** — Move Library Tier 1 (migration 010)
- Endpoint: `PATCH /api/user-tags/:id/video`
- Body: `{ has_video?, video_thumbnail?, video_duration_seconds?, video_notes? }`
- Per-field validation: thumbnail must start with `data:image/` and be ≤ 32KB; duration 0–600 sec; notes ≤ 1000 chars
- The actual video file is NEVER sent to the server — it lives in browser-local storage. This endpoint only persists metadata that should sync.
- Ownership enforced via `WHERE user_id = $userId` in the model

**`deleteUserTag(req, res)`**
- Calls `userTagModel.deleteUserTag(userId, id)` with ownership check
- Session `user_tag_ids` arrays are not cleaned up — orphans filtered at display time on the frontend

---

### `canonicalPositionController.ts`

Read-only public-library endpoint added in migration 012. Serves the curated ~60 BJJ-position vocabulary (Closed Guard, De La Riva, Armbar, etc.) with alias arrays for typeahead matching. There are no write handlers — additions/edits land via new migrations or future admin tooling.

**`getCanonicalPositions(req, res)`** — `GET /api/canonical-positions[?pillar=guard]`
1. Optional `?pillar=` query param filters by `parent_pillar` (one of the 5 valid pillars). Unknown values fall back to the full list.
2. Delegates to `canonicalPositionModel.getAllCanonicalPositions()` or `getCanonicalPositionsByPillar(pillar)`.
3. Computes a weak ETag = `"W/<sha1(id:name|id:name|...)>"` over the result set so the cache invalidates only when the table mutates (i.e. a new migration ships).
4. If `If-None-Match` matches the ETag → 304 with no body.
5. Otherwise 200 with `{ positions: CanonicalPosition[] }` + headers `ETag` and `Cache-Control: private, max-age=3600`.

The frontend `useCanonicalPositions()` hook wraps this with a module-level promise cache so all components share one fetch per page load.

---

## Routes

| File | Prefix | Middleware |
|---|---|---|
| `authRoutes.ts` | `/auth` | Rate limiter (10/15min) on POST routes |
| `sessionRoutes.ts` | `/api/sessions` | `verifyToken` on all; includes `GET /search` |
| `profileRoutes.ts` | `/api/profile` | `verifyToken` on all |
| `intentionRoutes.ts` | `/api/intentions` | `verifyToken` on all |
| `userTagRoutes.ts` | `/api/user-tags` | `verifyToken` on all. Includes `PATCH /:id/video` for Move Library metadata (migration 010). |
| `canonicalPositionRoutes.ts` | `/api/canonical-positions` | `verifyToken` on all. Read-only — single `GET /` returns the curated library (migration 012). |

---

## Known Issues & Future Work

| Issue | Notes |
|---|---|
| Traction formula (Phase 2) | `resonance` is stored, but the Traction metric (objective alignment × 0.7 + subjective resonance × 0.3) is not yet computed or exposed |
| Session `date` not editable | `date` field is set on creation; no endpoint to change it |
| No PATCH for intention fields | Label, category, duration cannot be changed post-creation |
| Tests broken | Vitest suite exists (`tests/` directory, Husky pre-commit hook) but currently fails on run — fixture/mock setup incomplete |
| No request logging | No middleware to log incoming requests |
| No `/health` endpoint | No dedicated health route — `GET /` serves as a smoke test |
| No pagination | All sessions / intentions returned in a single response |

---

## Admin + Support Cases (mig 023)

Single-admin SaaS troubleshooting surface. Adds the founder-only `/admin`
dashboard for stats / cases / recent users, plus a "Report a Problem"
flow that any authed user can submit from their profile page.

### Middleware

- **`verifyToken`** (`authMiddleware.ts`) — unchanged; attaches `req.user = { id, email }`.
- **`requireAdmin`** (`authMiddleware.ts`) — chained AFTER `verifyToken` on admin-only routes. Reads `users.is_admin` (mig 023) and rejects with 403 if false.

### Models

- **`supportCaseModel.ts`** — `createCase` (any authed user), `listCases(status?)` (joined with users.email/name), `updateCase(id, input)` (status / severity / admin_notes; auto-stamps `closed_at` on close, clears on reopen).
- **`profileModel.ts`** — `Profile` interface extended with `is_admin: boolean`. `getProfile` SELECT includes the column. `updateProfile` does NOT update it (admin grant is DB-level only).

### Controllers

- **`supportCaseController.ts`** — `submitCase` (POST /api/cases). Zod-validated subject/description + optional auto-context. Creates a case at `severity='normal', status='open'`.
- **`adminController.ts`** — `getStats` (single-row aggregate of users / sessions / cases over 24h+7d windows), `getCases` (with optional `?status` filter), `patchCase` (admin updates), `getUsers` (last 50 signups + session counts).

### Routes

- **`caseRoutes.ts`** — mounted at `/api/cases`. `verifyToken` only. Single endpoint: `POST /`.
- **`adminRoutes.ts`** — mounted at `/api/admin`. `verifyToken` + `requireAdmin`. Endpoints: `GET /stats`, `GET /cases`, `PATCH /cases/:id`, `GET /users`.
