# Database Reference

**Engine:** PostgreSQL hosted on Supabase
**Connection:** `pg` connection pool via `src/config/db.ts`
**SSL:** `rejectUnauthorized: false` (required for Supabase)
**Pool:** max 20 connections, 5s connection timeout, 30s idle timeout, `application_name: 'journada-backend'`

---

## Tables

### `users`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | — | Lowercase enforced at app layer (`.toLowerCase().trim()` in auth controller) |
| `password_hash` | VARCHAR(255) | NOT NULL | — | bcrypt, 12 rounds |
| `name` | VARCHAR(255) | nullable | NULL | |
| `belt_rank` | VARCHAR(50) | nullable, CHECK | NULL | `white` / `blue` / `purple` / `brown` / `black` (constraint added in migration 006) |
| `stripes` | INTEGER | nullable | NULL | 0–4 |
| `home_gym_name` | VARCHAR(255) | nullable | NULL | |
| `home_gym_address` | TEXT | nullable | NULL | Full formatted address |
| `home_gym_place_id` | VARCHAR(255) | nullable | NULL | Google Places ID |
| `intentions_enabled` | BOOLEAN | NOT NULL | TRUE | Feature flag (migration 004) |
| `timezone` | VARCHAR(64) | NOT NULL | `'UTC'` | IANA timezone (e.g. `America/Los_Angeles`). Synced from client via PATCH `/api/profile/timezone`. Used by the notification scheduler (migration 019). |
| `onboarding_completed_at` | TIMESTAMPTZ | nullable | NULL | NULL = user has not completed the first-time onboarding flow yet. Set to `NOW()` via `POST /api/profile/onboarding-complete` once the user finishes the guided flow. Migration 022. Pre-existing rows are backfilled to `NOW()` so they don't get force-routed into onboarding on next visit. |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

---

### `training_sessions`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `user_id` | UUID | FK → `users.id` CASCADE, NOT NULL | — | |
| `date` | DATE | NOT NULL | — | YYYY-MM-DD; no unique constraint on (user_id, date) — multiple sessions per day allowed |
| `duration` | INTEGER | NOT NULL, CHECK 1–720 | — | Minutes (constraint added in migration 006) |
| `gi_nogi` | VARCHAR(10) | NOT NULL, CHECK | — | `gi` or `no_gi` (constraint added in migration 006) |
| `intensity` | INTEGER | NOT NULL, CHECK 1–5 | — | |
| `session_type` | VARCHAR(50) | NOT NULL, CHECK | — | `class` / `drilling` / `competition_training` (constraint added in migration 006) |
| `notes` | TEXT | nullable | NULL | |
| `tags` | TEXT[] | NOT NULL | `{}` | Skill tags array — auto-derived from `heading` if not supplied |
| `heading` | VARCHAR(20) | nullable, CHECK | NULL | Pillar focus: `standup` / `passing` / `pins` / `submissions` / `guard`. Migration 005; constraint 006 |
| `polarity` | VARCHAR(10) | nullable, CHECK | NULL | `offense` / `defense` / `neutral`. Migration 005; constraint 006 |
| `sub_skill_tag` | TEXT | nullable | NULL | **Legacy** freeform sub-skill (max 50 chars). Replaced by `user_tag_ids` in migration 008 — kept for backward compat. New sessions don't write this. Migration 005 |
| `script_source` | VARCHAR(10) | nullable, CHECK | NULL | `directed` / `organic`. Migration 005; constraint 006 |
| `resonance` | SMALLINT | nullable, CHECK 1–10 | NULL | Haptic score. Form sends 2/4/6/8/10 (5 dots). Migration 005; constraint 006 |
| `user_tag_ids` | UUID[] | nullable | NULL | References `user_tags.id` — array of personal vocabulary tags for this session. No FK enforcement (orphans filtered at display). Migration 008 |
| `pillar_distribution` | JSONB | nullable, CHECK type=object | NULL | IDW weight vector from PillarPrism: `{"guard": 0.75, "passing": 0.25}`. Sum ≈ 1.0 (server renormalizes). Muted vertices are absent from the JSONB entirely (not zero-keyed). Backfilled in migration 009 from heading or tags. Drives proportional analytics. |
| `canonical_position_ids` | UUID[] | nullable | NULL | References `canonical_positions.id` — array of curated global library tags (e.g. "De La Riva", "Armbar"). Independent of `user_tag_ids` (private customs). No FK enforcement; orphan IDs dropped at sanitisation. Migration 012 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

---

### `weekly_intentions`

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `user_id` | UUID | FK → `users.id` CASCADE, NOT NULL | — | |
| `week_start` | DATE | NOT NULL | — | Start date of this intention (not necessarily Monday since mid-week pivots) |
| `intent_label` | TEXT | NOT NULL | — | Optional flavor text, max 20 chars. Defaults to heading label if empty. |
| `intent_category` | TEXT | nullable, CHECK | NULL | `technical` / `physical` / `mental` / `positional` / `competitive` (constraint 006). Legacy — new intentions use `heading` instead. |
| `heading` | VARCHAR(20) | nullable, CHECK | NULL | Prism vertex: `standup` / `passing` / `pins` / `submissions` / `guard`. Migration 007. |
| `duration_days` | INTEGER | NOT NULL, CHECK 1–30 | 7 | Added in migration 002 |
| `journal_entry` | TEXT | nullable | NULL | Added in migration 003 |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

**Unique constraint:** `(user_id, week_start)` — one intention per user per start date
**Index:** `idx_weekly_intentions_user_week` on `(user_id, week_start DESC)`

---

---

### `user_tags`

User-defined personal vocabulary, each linked to a parent pillar. The 5 pillars drive the math; user tags drive personal vocabulary (e.g. "berimbolo" → guard, "kimura" → submissions). Added in migration 008.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `user_id` | UUID | FK → `users.id` CASCADE, NOT NULL | — | |
| `name` | TEXT | NOT NULL, CHECK length 1–50 | — | User's tag name |
| `parent_pillar` | VARCHAR(20) | NOT NULL, CHECK | — | One of: `standup`, `passing`, `pins`, `submissions`, `guard` |
| `aliases` | TEXT[] | NOT NULL | `{}` | Optional alternate spellings for typeahead (e.g. ["dlr", "de la hiva"] → "De La Riva"). Migration 012. Currently the API doesn't expose alias editing — column exists for parity with `canonical_positions` and a future tag-management UI. |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |
| `has_video` | BOOLEAN | NOT NULL | FALSE | Move Library: client-set when local video saved. Advisory — server can't verify. Migration 010 |
| `video_thumbnail` | TEXT | nullable | NULL | data URL (`data:image/jpeg;base64,...`), ~10KB, extracted from first non-black frame. Migration 010 |
| `video_duration_seconds` | INTEGER | nullable, CHECK 0–600 | NULL | Migration 010 |
| `video_notes` | TEXT | nullable, CHECK length ≤ 1000 | NULL | Per-technique description (separate from session notes). Migration 010 |

**Unique constraint:** `(user_id, name)` — one tag per name per user (idempotent create on POST).
**Indexes:**
- `idx_user_tags_user_id` on `(user_id)`
- `idx_user_tags_has_video` on `(user_id) WHERE has_video = TRUE` — partial index for the "library has video" filter (migration 010)

Sessions reference user tags via `training_sessions.user_tag_ids UUID[]` (also added in migration 008). The relationship is one-way — there is no FK from the array to `user_tags.id`. Deleting a tag leaves orphan IDs in session arrays; the frontend filters them out at display time.

The actual video file is **never stored on the server** — only the metadata above. The video lives in browser-local storage (OPFS or IndexedDB) keyed by tag id. This gives users a personal video library at zero infrastructure cost; cloud sync is a future Tier 2 (see roadmap Sprint 7).

---

### `canonical_positions`

Curated global BJJ-position vocabulary, shared read-only across all users. Seeded with ~60 canonical positions in migration 012 (Closed Guard, De La Riva, Armbar, Triangle, etc.) plus alias arrays so users can search by common variants ("DLR" → "De La Riva"). Distinct from `user_tags`, which is per-user private vocabulary.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `name` | TEXT | UNIQUE, NOT NULL, CHECK length 1–50 | — | Canonical position name (e.g. "De La Riva", "Armbar") |
| `parent_pillar` | VARCHAR(20) | NOT NULL, CHECK | — | One of: `standup`, `passing`, `pins`, `submissions`, `guard` |
| `aliases` | TEXT[] | NOT NULL | `{}` | Alternate spellings / abbreviations matched by `TagPicker` typeahead (e.g. ["DLR", "de la hiva", "dlr guard"]) |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

**Index:** `idx_canonical_positions_pillar` on `(parent_pillar)` for the optional `?pillar=` filter.

**Curator model:** No user write path. Rows arrive only via seed migrations or future admin tooling. Custom positions a user types stay in their `user_tags` table; promoting a popular custom into canonical is a manual curator action (planned admin UI, not yet built).

**Linkage:** `training_sessions.canonical_position_ids UUID[]` references rows here (no FK). Sessions can carry both `user_tag_ids` (private) and `canonical_position_ids` (shared) independently.

---

### `password_reset_tokens`

Auto-created on backend startup via inline migration in `app.ts` (not a `.sql` file).

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `user_id` | UUID | FK → `users.id` CASCADE, NOT NULL | — | |
| `token` | TEXT | UNIQUE, NOT NULL | — | Hex token (32 random bytes) sent in reset email |
| `expires_at` | TIMESTAMPTZ | NOT NULL | — | 1 hour from creation |
| `used` | BOOLEAN | NOT NULL | FALSE | Marked true after successful reset |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

**Index:** `idx_password_reset_tokens_token` on `(token)` for fast lookup.

---

### `class_schedules`

User-defined recurring class times. One row per (user, day-of-week) slot. Times are stored in the user's local clock; the notification scheduler converts UTC → IANA at fire time. Soft-delete via `is_active` so we never break referenced rows.

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `user_id` | UUID | FK → `users.id` CASCADE, NOT NULL | — | |
| `name` | VARCHAR(120) | NOT NULL | — | "Tue Night BJJ", "Open Mat" |
| `day_of_week` | SMALLINT | NOT NULL, CHECK 0–6 | — | 0=Sun, 1=Mon, … 6=Sat |
| `start_time` | TIME | NOT NULL | — | User-local clock (e.g. `19:00:00`) |
| `duration_min` | SMALLINT | NOT NULL, CHECK 15–480 | 90 | |
| `gi_nogi` | VARCHAR(8) | nullable, CHECK | NULL | `gi` / `no_gi` / NULL |
| `is_active` | BOOLEAN | NOT NULL | TRUE | Soft-delete flag |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

**Index:** `class_schedules_user_active_idx` on `(user_id, is_active) WHERE is_active` (partial index).

---

### `push_subscriptions`

Web Push subscription objects, one row per browser-device install. Per-category opt-in flags follow the Headspace pre-permission UX (the user picks which kinds of pings they want before the OS dialog fires).

| Column | Type | Constraints | Default | Notes |
|---|---|---|---|---|
| `id` | UUID | PK | `gen_random_uuid()` | |
| `user_id` | UUID | FK → `users.id` CASCADE, NOT NULL | — | |
| `endpoint` | TEXT | UNIQUE, NOT NULL | — | Browser push-service URL — upsert key |
| `p256dh` | TEXT | NOT NULL | — | Public key from `pushManager.subscribe().getKey('p256dh')` |
| `auth` | TEXT | NOT NULL | — | Auth secret from `pushManager.subscribe().getKey('auth')` |
| `user_agent` | TEXT | nullable | NULL | E.g. "iPhone 15 / iOS 17.4 PWA" |
| `pre_class` | BOOLEAN | NOT NULL | TRUE | Opt-in for the T-30 reminder |
| `intention_check` | BOOLEAN | NOT NULL | TRUE | Opt-in for the T+0 check-in |
| `drive_home_log` | BOOLEAN | NOT NULL | TRUE | Opt-in for the T+8 log reminder |
| `last_seen` | TIMESTAMPTZ | NOT NULL | `NOW()` | Refreshed on every upsert |
| `created_at` | TIMESTAMPTZ | NOT NULL | `NOW()` | |

**Index:** `push_subscriptions_user_idx` on `(user_id)`.
**Cleanup:** rows are deleted automatically on push-send failure with HTTP 410 Gone or 404 Not Found (browser unsubscribed or endpoint expired).

---

## Migrations

Migration files (`.sql`) are in `backend_api/migrations/`, numbered sequentially. They are **auto-applied on server startup** via the migration runner in `app.ts`. Applied migrations are tracked in the `schema_migrations` table (name + applied_at), so each migration runs exactly once.

The `password_reset_tokens` table is also auto-created inline in `app.ts` (legacy, idempotent).

### `schema_migrations` (system table)

| Column | Type | Constraints | Default |
|---|---|---|---|
| `name` | TEXT | PK | — |
| `applied_at` | TIMESTAMPTZ | NOT NULL | `NOW()` |

### `001_add_weekly_intentions.sql`
- Creates `weekly_intentions` table with unique constraint on `(user_id, week_start)`
- Adds `intent_resonance SMALLINT CHECK (intent_resonance IN (1,2,3))` to `training_sessions`

### `002_add_intention_duration.sql`
- Adds `duration_days INTEGER NOT NULL DEFAULT 7 CHECK (duration_days BETWEEN 1 AND 30)` to `weekly_intentions`

### `003_add_journal_entry.sql`
- Adds `journal_entry TEXT` (nullable) to `weekly_intentions`

### `004_add_intentions_enabled.sql`
- Adds `intentions_enabled BOOLEAN NOT NULL DEFAULT TRUE` to `users`

### `005_dynamic_pillar_engine.sql`
- Renames legacy tag values in all existing rows via `array_replace`
- Adds `heading`, `polarity`, `sub_skill_tag`, `script_source` to `training_sessions`
- Renames `intent_resonance` → `resonance` (now 1–10)

### `006_indexes_and_constraints.sql`
- **Indexes:** `idx_training_sessions_user_id`, `idx_training_sessions_user_date`, `idx_password_reset_tokens_user_used`
- **CHECK constraints:** `gi_nogi`, `session_type`, `duration`, `heading`, `polarity`, `script_source`, `resonance` on `training_sessions`; `belt_rank` on `users`; `intent_category` on `weekly_intentions`
- All constraints use `DO $$ ... EXCEPTION WHEN duplicate_object` for idempotency

### `007_intention_heading.sql`
- Adds `heading VARCHAR(20)` to `weekly_intentions` for direct Prism vertex link
- CHECK constraint: same valid values as `training_sessions.heading`
- Enables Prism-tap intention setting (tap a vertex instead of typing a label)
- Mid-week pivot support: controller shortens old intention, creates new one from today

### `008_user_tags.sql`
- Creates `user_tags` table — user-defined personal vocabulary linked to parent pillars
- CHECK constraints: `name` length 1–50, `parent_pillar` in valid pillar set
- Unique constraint on `(user_id, name)` — enables idempotent tag creation
- Index on `(user_id)` for fast library lookup
- Adds `user_tag_ids UUID[]` column to `training_sessions` (nullable, no FK enforcement)
- Two-tier taxonomy: 5 fixed pillars drive math, user tags drive vocabulary
- Replaces `sub_skill_tag` (single freeform string) — old column kept for backward compat reads

### `009_pillar_distribution.sql`
- Adds `pillar_distribution JSONB` column to `training_sessions` — IDW weight vector from PillarPrism (e.g. `{"guard": 0.75, "passing": 0.25}`)
- CHECK constraint: must be `null` or a JSON object
- Inline backfill: existing sessions get `{heading: 1.0}` if heading is set, else even-split across `tags`
- Validation (sum-to-1.0, valid pillar keys, weight range) is enforced at the application layer
- Unlocks zero-sum analytics, per-pillar ACWR, distribution-aware visuals

### `010_user_tag_video_metadata.sql`
- Move Library (Tier 1): adds `has_video`, `video_thumbnail`, `video_duration_seconds`, `video_notes` to `user_tags`
- CHECK constraints: duration 0–600 sec, notes ≤ 1000 chars
- Partial index `idx_user_tags_has_video` on `(user_id) WHERE has_video = TRUE` for library filtering
- Server stores only metadata + thumbnail data URL — video files live client-side in OPFS/IndexedDB
- See roadmap Sprint 7 for the full Tier 1 / Tier 2 strategy

### `011_fix_belt_rank_default.sql`
- Drops the `DEFAULT 'White'` that had been set on `users.belt_rank` when the column was originally created manually on Supabase
- The uppercase default conflicted with the lowercase `CHECK (belt_rank IN ('white','blue','purple','brown','black'))` added by migration 006, which caused every new registration to fail with a `check_belt_rank` violation
- `createUser` in `userModel.ts` only inserts `(email, password_hash)`, so the column default was what ended up in the row
- After this migration new rows insert `NULL` for `belt_rank`; the UI already falls back to "White" for null so users see no change
- Surfaced by the `e2e/usage.spec.ts` behavioral suite during self-seed registration

### `012_canonical_positions.sql`
- Creates the `canonical_positions` table — curated global BJJ-position vocabulary shared by all users
- CHECK constraints: `parent_pillar` in valid pillar set, `name` length 1–50; UNIQUE constraint on `name`
- Index on `(parent_pillar)` for the `?pillar=` filter on the GET endpoint
- Seeds ~60 canonical positions inline (idempotent via `ON CONFLICT (name) DO NOTHING`):
  - Guard (18): Closed Guard, Open Guard, Half Guard, Deep Half, Z-Guard, Butterfly, De La Riva, Reverse De La Riva, Lasso, Spider, X-Guard, Single Leg X, 50/50, Rubber, Worm, K-Guard, Seated, Octopus
  - Passing (10): Torreando, Knee Slice, Over-Under, Double Under, Leg Drag, Long Step, Smash, X-Pass, Headquarters, Body Lock
  - Pins (7): Side Control, Mount, Knee on Belly, North-South, Back Control, Turtle Top, Technical Mount
  - Submissions (15): RNC, Bow & Arrow, Triangle, Armbar, Kimura, Americana, Omoplata, Straight Ankle Lock, Heel Hook, Kneebar, Toe Hold, D'Arce, Anaconda, Guillotine, Cross Collar
  - Stand-up (10): Double Leg, Single Leg, Arm Drag, Seoi Nage, Osoto Gari, O-Uchi Gari, Foot Sweep, Snap Down, Ankle Pick, Guard Pull
  - Each row has aliases (e.g. "De La Riva" → ["DLR", "de la hiva", "dlr guard"]) for typeahead matching
- Adds `aliases TEXT[] NOT NULL DEFAULT '{}'` to `user_tags` for parity (so user customs can carry aliases too in the future)
- Adds `canonical_position_ids UUID[]` to `training_sessions` (nullable, no FK enforcement — orphans dropped at API sanitisation)
- TagPicker now searches both libraries simultaneously (canonical + user) and matches against name + aliases

---

## Model Functions

### `userModel.ts`

```ts
findUserByEmail(email: string): Promise<User | null>
createUser(email: string, passwordHash: string): Promise<User>
findUserById(id: string): Promise<User | null>
updatePasswordHash(userId: string, newHash: string): Promise<void>
```

### `sessionModel.ts`

```ts
createSession(userId, date, duration, giNogi, intensity, sessionType, notes, tags, heading, polarity, subSkillTag, scriptSource, resonance, userTagIds, pillarDistribution, canonicalPositionIds): Promise<Session>
getSessionsByUser(userId: string, from?: string, to?: string): Promise<Session[]>   // ordered date DESC; filters by date range if params provided
searchSessions(userId, filters: SessionFilter): Promise<{ sessions, total }>        // multi-criteria filter incl. user_tag_id (matches via ANY())
updateSession(id, userId, duration, giNogi, intensity, sessionType, notes, tags, heading, polarity, subSkillTag, scriptSource, resonance, userTagIds, pillarDistribution, canonicalPositionIds): Promise<Session | null>
deleteSession(id: string, userId: string): Promise<boolean>
bulkInsertSessions(userId: string, sessions: BulkSessionInput[]): Promise<number>  // transactional; pillar_distribution NOT yet supported in bulk import
```

`PillarDistribution` is exported from `sessionModel.ts` as `Partial<Record<Pillar, number>>` — used by both the create/update signatures and the controller's sanitizer.

### `canonicalPositionModel.ts`

```ts
getAllCanonicalPositions(): Promise<CanonicalPosition[]>                       // ordered name ASC; full library
getCanonicalPositionsByPillar(pillar: Pillar): Promise<CanonicalPosition[]>    // filtered by parent_pillar (uses idx_canonical_positions_pillar)
filterExistingCanonicalIds(ids: string[]): Promise<string[]>                   // membership check — drops unknown IDs silently (mirrors sanitizeUserTagIds pattern in sessionController)
```

`CanonicalPosition` shape: `{ id, name, parent_pillar, aliases: string[], created_at }`. Library is read-only at runtime — no insert/update/delete model functions; mutations come only from migrations or future admin tooling.

### `userTagModel.ts`

```ts
getUserTags(userId: string): Promise<UserTag[]>                                   // ordered name ASC
getUserTagsByIds(userId: string, ids: string[]): Promise<UserTag[]>              // ownership lookup (used by sessionController to validate user_tag_ids)
findUserTagByName(userId: string, name: string): Promise<UserTag | null>         // direct name lookup (currently unused; available for future tag management UI)
upsertUserTag(userId, name, parentPillar): Promise<{ tag: UserTag; created: boolean }>  // atomic INSERT ... ON CONFLICT (user_id, name) DO UPDATE — race-safe idempotent. `created` distinguishes 201 vs 200 response.
updateUserTag(userId, id, name | null, parentPillar | null): Promise<UserTag | null>  // dynamic: only updates non-null fields
updateUserTagVideo(userId, id, patch): Promise<UserTag | null>                   // dynamic: patches has_video / thumbnail / duration / notes (migration 010)
deleteUserTag(userId, id): Promise<boolean>                                      // leaves orphan IDs in session arrays
```

### `passwordResetModel.ts`

```ts
createResetToken(userId: string, token: string, expiresAt: Date): Promise<void>
findValidToken(token: string): Promise<PasswordResetToken | null>  // unused + unexpired only
markTokenUsed(id: string): Promise<void>
```

### `profileModel.ts`

```ts
getProfile(userId: string): Promise<Profile | null>
updateProfile(userId: string, data: Profile): Promise<Profile>  // replaces entire profile
```

### `intentionModel.ts`

```ts
createIntention(userId, weekStart, intentLabel, intentCategory, durationDays): Promise<Intention>
getAllIntentions(userId: string): Promise<Intention[]>           // ordered week_start DESC
getIntentionByWeek(userId, weekStart): Promise<Intention | null>
updateJournalEntry(userId, id, journalEntry): Promise<Intention | null>
deleteIntention(userId, id): Promise<boolean>
```

---

## Important Notes

- **DATE serialisation:** Backend now registers a global `pg.types.setTypeParser(types.builtins.DATE, v => v)` in `config/db.ts` so every PostgreSQL DATE column comes back as a raw `YYYY-MM-DD` string instead of a JS `Date` object. This matches the TypeScript contracts (`week_start: string`, `date: string`) used across all models and unblocks `.slice(0, 10)` calls in controllers (e.g. `intentionController.createIntention` mid-week pivot, `sessionController` CSV-import duplicate detection). Older code that called `.toISOString().slice(0, 10)` defensively is still fine — it's a no-op on a string.
- **Multiple sessions per day:** No unique constraint on `(user_id, date)` in `training_sessions`. The app intentionally supports multiple sessions per day (e.g., morning class + evening open mat).
- **resonance:** 1–10 haptic score (was `intent_resonance`). Stored as even values (2/4/6/8/10), displayed as 5 dots in `LogSessionForm`. Renamed and wired up in migration 005.
- **password_reset_tokens:** Table is created via inline SQL in `app.ts` on every startup (idempotent — uses `CREATE TABLE IF NOT EXISTS`).
- **Migration runner:** `app.ts` auto-runs numbered `.sql` files from `backend_api/migrations/` on startup, tracked via the `schema_migrations` table. Each migration runs exactly once. Add new migrations as `007_description.sql` etc.
- **Connection pool:** max 20, 5s connect timeout, 30s idle timeout. Sized for Railway single-instance deployment. Increase `max` if adding horizontal scaling.

---

## `support_cases` (mig 023)

Backs the admin dashboard's case queue. Any authed user can `POST /api/cases`
to create a row; only admins can read / mutate via `/api/admin/cases` (gated
by `requireAdmin`). Auto-context fields are captured by the client at submit
time so the user types subject + description and the admin gets full debug
context.

| Column        | Type           | Notes |
|---|---|---|
| `id`          | UUID PK        | `gen_random_uuid()` |
| `user_id`     | UUID FK        | → `users.id`, ON DELETE CASCADE |
| `status`      | VARCHAR(20)    | CHECK in (`open`, `in_progress`, `closed`); default `open` |
| `severity`    | VARCHAR(20)    | CHECK in (`low`, `normal`, `high`, `urgent`); default `normal` |
| `subject`     | VARCHAR(200)   | Single-line user-supplied summary |
| `description` | TEXT           | Multi-line user-supplied detail |
| `page_url`    | TEXT           | Auto: `window.location.href` at submit time |
| `user_agent`  | TEXT           | Auto: `navigator.userAgent` |
| `app_version` | VARCHAR(40)    | Auto: `VITE_APP_VERSION` env var |
| `admin_notes` | TEXT           | Admin-side triage notes (editable from /admin) |
| `created_at`  | TIMESTAMPTZ    | Default `NOW()` |
| `updated_at`  | TIMESTAMPTZ    | Set by model on every PATCH |
| `closed_at`   | TIMESTAMPTZ    | Stamped when status flips to `closed`; cleared on reopen |

**Indexes:** `(user_id)`, `(status)`, `(created_at DESC)`.

**Functions in `supportCaseModel.ts`:**
```
createCase(input): Promise<SupportCase>            // any authed user
listCases(status?): Promise<SupportCaseWithUser[]> // joined with users.email/name
updateCase(id, input): Promise<SupportCase | null> // admin only
```

## `users.is_admin` (mig 023)

Single-bit flag added to the existing `users` table. Defaults `false`.
Granted via direct DB UPDATE — there is no API to set this. Drives the
conditional "Admin Dashboard" link on the profile page and the
`requireAdmin` middleware on `/api/admin/*` routes.

```sql
UPDATE users SET is_admin = true WHERE email = '<your-email>';
```

---

## Planned Tables

| Table | Purpose |
|---|---|
| `belt_promotions` | Promotion history (date, rank, promoter) |
| `refresh_tokens` | JWT refresh token store for longer sessions |
