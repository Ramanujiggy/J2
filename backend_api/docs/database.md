# Database Schema

PostgreSQL hosted on Supabase. Connected via the `pg` pool in `src/config/db.ts` using `DATABASE_URL` from the environment. SSL is enabled with `rejectUnauthorized: false`.

---

## Tables

### `users`

Stores identity, auth credentials, and profile data. One row per registered user.

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
| `created_at` | `timestamptz` | default `NOW()` | |

#### Valid `tags` values

Defined in `frontend_app/src/lib/constants.ts` and validated in `sessionController.ts`:

| Tag value | Display label |
|---|---|
| `standup` | Stand-up |
| `guard_retention` | Guard Retention |
| `submissions` | Submissions |
| `pin_escapes` | Pin Escapes |
| `guard_passing` | Guard Passing |

---

### `password_reset_tokens`

Short-lived tokens for the password reset flow. Created by `POST /auth/request-password-reset`, consumed by `POST /auth/reset-password`.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | Cascade delete on user removal |
| `token` | `text` | UNIQUE, NOT NULL | 32 random bytes, hex-encoded |
| `expires_at` | `timestamptz` | NOT NULL | 1 hour after creation |
| `used` | `boolean` | NOT NULL, default `false` | Set to `true` after successful reset |
| `created_at` | `timestamptz` | NOT NULL, default `now()` | |

Index: `idx_password_reset_tokens_token` on `token` for fast lookups.

> **This table is created automatically** when the backend starts (`CREATE TABLE IF NOT EXISTS` runs in `app.ts`). No manual migration needed.

---

### `intentions`

One row per weekly training intention per user.

| Column | Type | Constraints | Notes |
|---|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` | |
| `user_id` | `uuid` | FK → `users.id`, NOT NULL | |
| `week_start` | `date` | NOT NULL | ISO Monday of the target week |
| `intent_label` | `varchar(20)` | NOT NULL | Short label, max 20 chars |
| `intent_category` | `varchar(50)` | nullable | `technical \| physical \| mental \| positional \| competitive` |
| `duration_days` | `integer` | nullable | |
| `journal_entry` | `text` | nullable | Free-form reflection |
| `created_at` | `timestamptz` | default `NOW()` | |

---

## Migrations

### Auto-applied on startup

`password_reset_tokens` — created automatically by `runMigrations()` in `src/app.ts` every time the backend starts (idempotent — uses `CREATE TABLE IF NOT EXISTS`).

### Manual (run once in Supabase SQL Editor)

```sql
-- Add tags column to training_sessions (required for SkillRadar analytics)
ALTER TABLE training_sessions
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
```

---

## Relationships

```
users (1) ──── (many) training_sessions
               via training_sessions.user_id → users.id

users (1) ──── (many) password_reset_tokens
               via password_reset_tokens.user_id → users.id

users (1) ──── (many) intentions
               via intentions.user_id → users.id
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
| Get user profile | `getProfile(userId)` | `SELECT name, belt_rank, stripes, home_gym_* FROM users WHERE id = $1` |
| Update profile | `updateProfile(userId, data)` | `UPDATE users SET … WHERE id = $1 RETURNING …` |
| Log session | `createSession(…)` | `INSERT INTO training_sessions … RETURNING *` |
| Get all sessions | `getSessionsByUser(userId)` | `SELECT * FROM training_sessions WHERE user_id = $1 ORDER BY date DESC` |
| Update session | `updateSession(id, userId, data)` | `UPDATE training_sessions SET … WHERE id = $1 AND user_id = $2 RETURNING *` |
| Create reset token | `createResetToken(userId, token, expiresAt)` | `INSERT INTO password_reset_tokens …` |
| Find valid token | `findValidToken(token)` | `SELECT … WHERE token = $1 AND used = false AND expires_at > NOW()` |
| Mark token used | `markTokenUsed(id)` | `UPDATE password_reset_tokens SET used = true WHERE id = $1` |
