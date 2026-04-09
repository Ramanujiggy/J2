# Database Schema

PostgreSQL hosted on Supabase. Connected via the `pg` pool in `src/config/db.ts` using `DATABASE_URL` from the environment. SSL is enabled with `rejectUnauthorized: false`.

---

## Tables

### `users`

Stores identity, auth credentials, profile data, and feature flags. One row per registered user.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `email` | `varchar(255)` | UNIQUE, NOT NULL | Lowercase enforced at app layer |
| `password_hash` | `varchar(255)` | NOT NULL | bcrypt, 12 rounds |
| `name` | `varchar(255)` | nullable | Display name |
| `belt_rank` | `varchar(50)` | nullable | `white \| blue \| purple \| brown \| black` |
| `stripes` | `integer` | nullable, 0–4 | Not applicable to white belt |
| `home_gym_name` | `varchar(255)` | nullable | |
| `home_gym_address` | `text` | nullable | Full formatted address |
| `home_gym_place_id` | `varchar(255)` | nullable | Google Places ID |
| `intentions_enabled` | `boolean` | NOT NULL, default `true` | Feature flag — hides intention UI when false |
| `created_at` | `timestamptz` | default `NOW()` | |

---

### `training_sessions`

One row per training session. Linked to a user via `user_id`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | Cascade delete on user removal |
| `date` | `date` | NOT NULL | Session date (not timestamp) |
| `duration` | `integer` | NOT NULL | Duration in **minutes** |
| `gi_nogi` | `varchar(10)` | NOT NULL | `gi \| no_gi` |
| `intensity` | `integer` | NOT NULL, 1–5 | Subjective effort level |
| `session_type` | `varchar(50)` | NOT NULL | `class \| drilling \| competition_training` |
| `notes` | `text` | nullable | Free-form session notes |
| `tags` | `text[]` | NOT NULL, default `'{}'` | Skill focus tags (see below) |
| `heading` | `varchar(20)` | nullable | Primary pillar selected in the Dynamic Pillar Engine |
| `polarity` | `varchar(10)` | nullable | `offense \| defense \| neutral` — shown for guard/pins headings |
| `sub_skill_tag` | `text` | nullable | Optional free-text sub-skill (e.g. "K-Guard") |
| `script_source` | `varchar(10)` | nullable | `directed \| organic` — class-led vs open mat |
| `resonance` | `integer` | nullable | How aligned the session felt with active intention (1–10, enforced at app layer only — no DB CHECK constraint) |
| `created_at` | `timestamptz` | default `NOW()` | |

#### Valid `tags` / `heading` values

Defined in `frontend_app/src/lib/constants.ts` and validated in `sessionController.ts`:

| Tag value | Display label |
|---|---|
| `standup` | Stand-up |
| `guard` | Guard |
| `submissions` | Submissions |
| `pins` | Dynamic Pins |
| `passing` | Guard Passing |

---

### `password_reset_tokens`

Short-lived tokens for the password reset flow. Created by `POST /auth/request-password-reset`, consumed by `POST /auth/reset-password`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | Cascade delete on user removal |
| `token` | `text` | UNIQUE, NOT NULL | SHA-256 hash of the 32-byte random token sent in the email link |
| `expires_at` | `timestamptz` | NOT NULL | 1 hour after creation |
| `used` | `boolean` | NOT NULL, default `false` | Set to `true` after successful reset |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Index: `idx_password_reset_tokens_token` on `token` for fast lookups.

> **This table is created automatically** when the backend starts (`CREATE TABLE IF NOT EXISTS` runs in `app.ts`). No manual migration needed.

---

### `weekly_intentions`

One row per weekly training intention per user. Uniqueness is enforced at both the DB level (`UNIQUE(user_id, week_start)`) and the application layer (409 on duplicate).

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | |
| `week_start` | `date` | NOT NULL | ISO Monday of the target week |
| `intent_label` | `text` | NOT NULL, `char_length ≤ 20` | Short label, max 20 chars |
| `intent_category` | `text` | nullable, CHECK enum | `technical \| physical \| mental \| positional \| competitive` |
| `duration_days` | `integer` | NOT NULL, default `7` | 1–30 (DB constraint); UI offers presets 3/5/7/14 |
| `journal_entry` | `text` | nullable | Free-form reflection, saved via PATCH |
| `created_at` | `timestamptz` | default `NOW()` | |

---

## Relationships

```
users (1) ──── (many) training_sessions
               via training_sessions.user_id → users.id  [CASCADE DELETE]

users (1) ──── (many) password_reset_tokens
               via password_reset_tokens.user_id → users.id  [CASCADE DELETE]

users (1) ──── (many) weekly_intentions
               via weekly_intentions.user_id → users.id  [CASCADE DELETE]
```

---

## Migrations

### Auto-applied on startup

`password_reset_tokens` — created automatically by `runMigrations()` in `src/app.ts` every time the backend starts (idempotent — uses `CREATE TABLE IF NOT EXISTS`).

### Manual (run once in Supabase SQL Editor)

Five numbered SQL files in `backend_api/migrations/`, applied in order:

```sql
-- 001_add_weekly_intentions.sql
-- Creates the weekly_intentions table and adds intent_resonance to training_sessions.
-- NOTE: the intent_resonance column and its check constraint were later superseded by
-- Migration 005 which renames it to 'resonance' and widens the range to 1–10.
CREATE TABLE IF NOT EXISTS weekly_intentions ( … );
ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS intent_resonance SMALLINT …;

-- 002_add_intention_duration.sql
ALTER TABLE weekly_intentions
  ADD COLUMN IF NOT EXISTS duration_days INTEGER NOT NULL DEFAULT 7
  CHECK (duration_days BETWEEN 1 AND 30);

-- 003_add_journal_entry.sql
ALTER TABLE weekly_intentions ADD COLUMN IF NOT EXISTS journal_entry TEXT;

-- 004_add_intentions_enabled.sql
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS intentions_enabled BOOLEAN NOT NULL DEFAULT TRUE;

-- 005_dynamic_pillar_engine.sql
-- Renames old tag values, adds pillar engine columns, renames intent_resonance → resonance (1–10).
UPDATE training_sessions SET tags = array_replace(tags, 'guard_retention', 'guard');
UPDATE training_sessions SET tags = array_replace(tags, 'pin_escapes',     'pins');
UPDATE training_sessions SET tags = array_replace(tags, 'guard_passing',   'passing');
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS heading       varchar(20),
  ADD COLUMN IF NOT EXISTS polarity      varchar(10),
  ADD COLUMN IF NOT EXISTS sub_skill_tag text,
  ADD COLUMN IF NOT EXISTS script_source varchar(10);
ALTER TABLE training_sessions RENAME COLUMN intent_resonance TO resonance;
-- The old check constraint (values 1–3) survives the rename. Drop it:
ALTER TABLE training_sessions DROP CONSTRAINT IF EXISTS training_sessions_intent_resonance_check;
```

---

## Query Patterns

All queries go through the `query()` helper in `src/config/db.ts` which wraps `pool.query()` with parameterized inputs.

| Operation | Model function | Query |
|---|---|---|
| Find user by email | `findUserByEmail(email)` | `SELECT … WHERE email = $1` |
| Find user by id | `findUserById(id)` | `SELECT … WHERE id = $1` |
| Create user | `createUser(email, hash)` | `INSERT INTO users … RETURNING id, email, created_at` |
| Update password | `updatePasswordHash(id, hash)` | `UPDATE users SET password_hash = $1 WHERE id = $2` |
| Get user profile | `getProfile(userId)` | `SELECT name, belt_rank, stripes, home_gym_*, intentions_enabled FROM users WHERE id = $1` |
| Update profile | `updateProfile(userId, data)` | `UPDATE users SET … WHERE id = $1 RETURNING …` |
| Log session | `createSession(…)` | `INSERT INTO training_sessions … RETURNING *` |
| Get all sessions | `getSessionsByUser(userId)` | `SELECT * FROM training_sessions WHERE user_id = $1 ORDER BY date DESC` |
| Update session | `updateSession(id, userId, data)` | `UPDATE training_sessions SET … WHERE id = $1 AND user_id = $2 RETURNING *` |
| Delete session | `deleteSession(id, userId)` | `DELETE FROM training_sessions WHERE id = $1 AND user_id = $2` |
| Bulk insert sessions | `bulkInsert(userId, sessions)` | Multi-row `INSERT` inside a `BEGIN/COMMIT` transaction |
| Create reset token | `createResetToken(userId, token, expiresAt)` | `INSERT INTO password_reset_tokens …` |
| Find valid token | `findValidToken(token)` | `SELECT … WHERE token = $1 AND used = false AND expires_at > NOW()` |
| Mark token used | `markTokenUsed(id)` | `UPDATE password_reset_tokens SET used = true WHERE id = $1` |
| Create intention | `createIntention(…)` | `INSERT INTO weekly_intentions … RETURNING *` |
| Get all intentions | `getIntentionsByUser(userId)` | `SELECT * FROM weekly_intentions WHERE user_id = $1 ORDER BY week_start DESC` |
| Get current intention | `getIntentionByWeek(userId, weekStart)` | `SELECT … FROM weekly_intentions WHERE user_id = $1 AND week_start = $2` |
| Save journal entry | `saveJournalEntry(id, userId, text)` | `UPDATE weekly_intentions SET journal_entry = $1 WHERE id = $2 AND user_id = $3` |
| Delete intention | `deleteIntention(id, userId)` | `DELETE FROM weekly_intentions WHERE id = $1 AND user_id = $2` |
