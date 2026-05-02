# API Reference

Base URL: `http://localhost:5000` (development)

All request/response bodies are JSON. Authenticated routes require `Authorization: Bearer <token>`.

**Status key:** ✅ Implemented · 🔲 Planned · ⚠️ Known gap

---

## Auth Routes

### POST `/auth/register` ✅
No auth required. Rate limited: 10 req / 15 min per IP.

**Request**
```json
{ "email": "user@example.com", "password": "secret" }
```

**Response 201**
```json
{ "message": "User registered successfully.", "user": { "id": "uuid", "email": "user@example.com" } }
```

**Errors**
- 400 — missing email or password
- 409 — email already registered
- 500 — server error

---

### POST `/auth/login` ✅
No auth required. Rate limited: 10 req / 15 min per IP.

**Request**
```json
{ "email": "user@example.com", "password": "secret" }
```

**Response 200**
```json
{ "message": "Login successful.", "token": "jwt.token.here", "user": { "id": "uuid", "email": "user@example.com" } }
```

**Notes**
- Token expires in 24h
- Returns generic error message on mismatch (no email enumeration)

**Errors**
- 400 — missing fields
- 401 — invalid credentials
- 429 — rate limit exceeded

---

### POST `/auth/logout` 🔲
Not yet implemented. Client-side logout clears the stored token; server does not maintain a blocklist.

---

### POST `/auth/request-password-reset` ✅
No auth required. Rate limited: 10 req / 15 min per IP.

Sends a one-time password reset link to the user's email via Resend SMTP. The link includes a signed token valid for 1 hour.

**Request**
```json
{ "email": "user@example.com" }
```

**Response 200**
```json
{ "message": "If that email exists, a reset link has been sent." }
```

Always returns 200 to avoid email enumeration. No SMTP config → falls back to Ethereal (emails not delivered in dev).

---

### POST `/auth/reset-password` ✅
No auth required. Rate limited: 10 req / 15 min per IP.

Resets the user's password using a valid, unused, non-expired token.

**Request**
```json
{ "token": "uuid-reset-token", "newPassword": "newSecret123" }
```

**Response 200**
```json
{ "message": "Password updated successfully." }
```

**Errors**
- 400 — missing fields, `newPassword` shorter than 8 characters, token invalid, token expired, or token already used

---

## Session Routes

All require `Authorization: Bearer <token>`.

### POST `/api/sessions` ✅

**Request**
```json
{
  "date": "2025-06-02",
  "duration": 90,
  "gi_nogi": "gi",
  "intensity": 4,
  "session_type": "class",
  "heading": "passing",
  "polarity": null,
  "sub_skill_tag": "leg drag",
  "script_source": "directed",
  "resonance": 8,
  "user_tag_ids": ["uuid-1", "uuid-2"],
  "canonical_position_ids": ["uuid-canonical-1", "uuid-canonical-2"],
  "pillar_distribution": { "passing": 0.75, "guard": 0.25 },
  "notes": "Worked on pressure passing."
}
```

**Field rules**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `date` | string | Yes | YYYY-MM-DD — validated with regex + `Date.parse()` in controller |
| `duration` | integer | Yes | 1–720 minutes — range validated in controller |
| `gi_nogi` | string | Yes | `"gi"` or `"no_gi"` |
| `intensity` | integer | Yes | 1–5 — range validated in controller |
| `session_type` | string | Yes | `"class"` / `"drilling"` / `"competition_training"` |
| `heading` | string | No* | One pillar from valid set — pre-session focus. `tags` auto-derived as `[heading]` if `tags` not supplied |
| `tags` | string[] | No* | If omitted, derived from `heading`. Must be from valid set if supplied. *Either `heading` or `tags` is required |
| `polarity` | string | No | `"offense"` / `"defense"` / `"neutral"` — only meaningful when `heading` is `guard` or `pins` |
| `sub_skill_tag` | string | No | **Legacy** free text sub-skill — superseded by `user_tag_ids` in migration 008. Kept for backward compat with older clients. |
| `script_source` | string | No | `"directed"` (instructor-led) / `"organic"` (open mat) |
| `resonance` | integer | No | 1–10. Form UI sends even values 2/4/6/8/10 (5 dots), but API accepts any integer in range |
| `user_tag_ids` | string[] | No | Array of `user_tags.id` (UUIDs). Personal vocabulary tags — replaces legacy `sub_skill_tag`. Server sanitizes: validates UUID format, deduplicates, drops IDs not owned by the authenticated user. Foreign or malformed IDs are silently filtered (no error). |
| `canonical_position_ids` | string[] | No | Array of `canonical_positions.id` (UUIDs) — references to the curated global library (e.g. "De La Riva", "Armbar"). Server sanitizes: validates UUID format, deduplicates, drops IDs not present in the canonical table. Independent of `user_tag_ids`. Migration 012. |
| `pillar_distribution` | object | No | IDW weight vector from PillarPrism: `{ "guard": 0.7, "passing": 0.3 }`. Server sanitizes: drops invalid pillar keys, drops weights outside [0,1], renormalizes to sum exactly 1.0. Falls back to `{ heading: 1.0 }` if absent. Drives proportional analytics. **Muted vertices** (toggled off via tap-on-vertex on the Prism) are absent from the JSONB entirely, not zero-keyed. Migration 009. |
| `notes` | string | No | Free text |

**Valid pillars (heading / tags):** `standup`, `passing`, `pins`, `submissions`, `guard`

**Response 201**
```json
{ "message": "Session logged.", "session": { ...session }, "session_count": 42 }
```

`session_count` — total sessions for the user after this insert (used by the frontend for milestone display).

**Errors**
- 400 — missing required fields or invalid tags/heading
- 401 — not authenticated

---

### GET `/api/sessions` ✅

Returns sessions for the authenticated user, ordered by date DESC. Supports optional date range filtering.

**Query params**
| Param | Type | Notes |
|---|---|---|
| `from` | string | Optional — YYYY-MM-DD. Return sessions on or after this date. |
| `to` | string | Optional — YYYY-MM-DD. Return sessions on or before this date. |

If neither param is provided, all sessions are returned. Either or both can be supplied independently.

**Response 200**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "date": "2025-06-02",
      "duration": 90,
      "gi_nogi": "gi",
      "intensity": 4,
      "session_type": "class",
      "notes": "...",
      "tags": ["passing"],
      "heading": "passing",
      "polarity": null,
      "sub_skill_tag": null,
      "script_source": "directed",
      "resonance": null,
      "created_at": "2025-06-02T..."
    }
  ]
}
```

---

### GET `/api/sessions/search` ✅

Filters sessions by multiple criteria. Used by SessionSearchPanel on CalendarPage and Analytics deep-dives.

**Query params**
| Param | Type | Notes |
|---|---|---|
| `from` | string | YYYY-MM-DD lower bound |
| `to` | string | YYYY-MM-DD upper bound |
| `gi_nogi` | string | `"gi"` or `"no_gi"` |
| `heading` | string | One pillar |
| `polarity` | string | `"offense"` / `"defense"` / `"neutral"` |
| `intensity` | integer | 1–5 |
| `session_type` | string | `"class"` / `"drilling"` / `"competition_training"` |
| `user_tag_id` | string | UUID — matches sessions whose `user_tag_ids` array contains this id |
| `text` | string | Full-text match against `notes` |
| `limit` | integer | Max results, default 100 |
| `offset` | integer | Pagination offset |

**Response 200**
```json
{ "sessions": [ ...session ], "total": 47 }
```

**Errors**
- 400 — invalid filter values
- 401 — not authenticated

---

### PUT `/api/sessions/:id` ✅

Updates an existing session. Ownership enforced — only the session owner can update.

**Request** — same fields as POST (all required except `notes`/`tags`). `user_tag_ids` and `canonical_position_ids` should both be passed when present — omitting them sets the column to `null` (clears the existing value).

**Response 200**
```json
{ "message": "Session updated.", "session": { ...session } }
```

**Errors**
- 400 — missing or invalid fields
- 401 — not authenticated
- 404 — session not found or not owned by user

---

### DELETE `/api/sessions/:id` ✅

Deletes a session. Ownership enforced — only the session owner can delete.

**Response 200**
```json
{ "message": "Session deleted." }
```

**Errors**
- 401 — not authenticated
- 404 — session not found or not owned by user

---

### POST `/api/sessions/import` ✅

Bulk import up to 2,000 sessions in a single transactional batch. All rows are inserted or none (rolls back on failure). Tags are optional (empty array allowed). Duplicate dates trigger a 409 unless `confirmDuplicates: true` is set.

**Request**
```json
{
  "sessions": [
    {
      "date": "2025-06-02",
      "duration": 90,
      "gi_nogi": "gi",
      "intensity": 4,
      "session_type": "class",
      "tags": ["guard"],
      "notes": "Optional",
      "heading": null,
      "polarity": null,
      "sub_skill_tag": null,
      "script_source": null,
      "resonance": null
    }
  ],
  "confirmDuplicates": false
}
```

- `tags` — optional, can be empty array `[]`. If provided, values must be valid (`standup`, `passing`, `pins`, `submissions`, `guard`).
- `heading`, `polarity`, `sub_skill_tag`, `script_source`, `resonance` — all optional, default null. Same validation as `POST /api/sessions` when present.
- `confirmDuplicates` — set `true` to bypass duplicate date check.

**Response 201**
```json
{ "imported": 42 }
```

**Response 409** (duplicate dates detected, `confirmDuplicates` not set)
```json
{ "message": "3 dates already exist in your log.", "duplicateDates": ["2025-06-02", "2025-06-03", "2025-06-04"] }
```

**Errors**
- 400 — payload is not an array, exceeds 2,000 rows, or contains invalid session data
- 401 — not authenticated
- 409 — duplicate dates found (re-send with `confirmDuplicates: true` to proceed)

---

## Profile Routes

All require `Authorization: Bearer <token>`.

### GET `/api/profile` ✅

**Response 200**
```json
{
  "profile": {
    "name": "Rob",
    "belt_rank": "blue",
    "stripes": 2,
    "home_gym_name": "Gracie Gym",
    "home_gym_address": "123 Main St",
    "home_gym_place_id": "ChIJ...",
    "intentions_enabled": true
  }
}
```

Returns `{ "profile": null }` if no profile data has been saved yet.

---

### PUT `/api/profile` ✅

All fields optional — missing fields are merged with existing profile values.

**Request**
```json
{
  "name": "Rob",
  "belt_rank": "blue",
  "stripes": 2,
  "home_gym_name": "Gracie Gym",
  "home_gym_address": "123 Main St",
  "home_gym_place_id": "ChIJ...",
  "intentions_enabled": true
}
```

**Field rules**
| Field | Type | Constraints |
|---|---|---|
| `name` | string \| null | max 100 chars |
| `belt_rank` | string \| null | `"white"` / `"blue"` / `"purple"` / `"brown"` / `"black"` |
| `stripes` | integer | 0–4 |
| `home_gym_name` | string \| null | max 200 chars |
| `home_gym_address` | string \| null | max 500 chars |
| `home_gym_place_id` | string \| null | max 200 chars |
| `intentions_enabled` | boolean | — |

Validated with Zod. Unrecognised fields are stripped.

**Response 200**
```json
{ "message": "Profile saved.", "profile": { ...profile } }
```

---

## Intention Routes

All require `Authorization: Bearer <token>`.

### POST `/api/intentions` ✅

**Request**
```json
{
  "intent_label": "Guard Game",
  "intent_category": "positional",
  "week_start": "2025-06-02",
  "duration_days": 7
}
```

**Field rules**
| Field | Type | Required | Constraints |
|---|---|---|---|
| `intent_label` | string | Yes | max 20 chars, trimmed |
| `intent_category` | string \| null | No | `"technical"` / `"physical"` / `"mental"` / `"positional"` / `"competitive"` |
| `week_start` | string | No | YYYY-MM-DD Monday; defaults to ISO Monday of current UTC date |
| `duration_days` | integer | No | 1–30, defaults to 7 |

One intention per user per week (409 if duplicate).

**Response 201**
```json
{ "message": "Intention set.", "intention": { ...intention } }
```

**Errors**
- 400 — invalid label, category, or duration
- 409 — intention already exists for that week

---

### GET `/api/intentions` ✅

Returns all intentions for the authenticated user, ordered by week_start DESC.

**Response 200**
```json
{
  "intentions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "week_start": "2025-06-02",
      "intent_label": "Guard Game",
      "intent_category": "positional",
      "duration_days": 7,
      "journal_entry": "...",
      "created_at": "2025-06-02T..."
    }
  ]
}
```

---

### GET `/api/intentions/current` ✅

Returns the intention for a specific week (or the current week if not specified).

**Query params**
- `week_start` (optional) — YYYY-MM-DD ISO Monday

**Response 200**
```json
{ "intention": { ...intention } }
```
or `{ "intention": null }` if none exists.

---

### DELETE `/api/intentions/:id` ✅

Deletes an intention. Ownership enforced.

**Response 200**
```json
{ "message": "Intention deleted." }
```

**Errors**
- 401 — not authenticated
- 404 — not found or not owned

---

### PATCH `/api/intentions/:id/journal` ✅

Updates the journal entry for an intention. Ownership enforced.

**Request**
```json
{ "journal_entry": "Focused on pressure from closed guard..." }
```

**Response 200**
```json
{ "message": "Journal entry saved.", "intention": { ...intention } }
```

**Errors**
- 400 — missing or non-string `journal_entry`
- 404 — not found or not owned

---

## User Tag Routes

The user's personal vocabulary library. Each tag is linked to a parent pillar — the 5 pillars drive the math, user tags drive personal vocabulary (e.g. "berimbolo" → guard).

All routes require `Authorization: Bearer <token>`. Base path: `/api/user-tags`.

### GET `/api/user-tags` ✅

Returns all tags in the user's library, ordered alphabetically.

**Response 200**
```json
{
  "tags": [
    { "id": "uuid", "user_id": "uuid", "name": "berimbolo", "parent_pillar": "guard", "created_at": "2026-04-14T..." },
    { "id": "uuid", "user_id": "uuid", "name": "kimura",    "parent_pillar": "submissions", "created_at": "..." }
  ]
}
```

### POST `/api/user-tags` ✅

Create a new tag. **Atomic and idempotent** — uses `INSERT ... ON CONFLICT (user_id, name) DO UPDATE` under the hood, so concurrent requests with the same name resolve to the same row without race conditions. If a tag with this name already exists, returns the existing row with status 200; otherwise creates and returns 201.

**Request**
```json
{ "name": "berimbolo", "parent_pillar": "guard" }
```

**Validation**
- `name`: required string, 1–50 chars after trim
- `parent_pillar`: required, must be one of `standup` / `passing` / `pins` / `submissions` / `guard`

**Response 201** (new tag created)
```json
{ "tag": { "id": "uuid", "user_id": "uuid", "name": "berimbolo", "parent_pillar": "guard", "created_at": "..." } }
```

**Response 200** (tag with this name already existed)
```json
{ "tag": { ... } }
```

**Errors**
- 400 — invalid name length or invalid pillar
- 401 — not authenticated

### PATCH `/api/user-tags/:id` ✅

Update name and/or parent_pillar of a tag. Only fields provided are updated.

**Request**
```json
{ "name": "berimbolo (DLR)", "parent_pillar": "guard" }
```

**Errors**
- 400 — invalid field value
- 404 — tag not found or not owned

### PATCH `/api/user-tags/:id/video` ✅

Update Move Library video metadata. Only fields explicitly passed are touched; pass `null` to clear.

The actual video file is **never sent to or stored on the server** — it lives in browser-local storage (OPFS / IndexedDB). This endpoint only persists the small metadata that should sync across devices. Migration 010.

**Request**
```json
{
  "has_video": true,
  "video_thumbnail": "data:image/jpeg;base64,/9j/4AAQ...",
  "video_duration_seconds": 17,
  "video_notes": "Off the back-step DLR; finish with deep half pivot."
}
```

**Field rules**
| Field | Type | Constraints |
|---|---|---|
| `has_video` | boolean | Advisory client-set flag |
| `video_thumbnail` | string \| null | Must start with `data:image/`. Max 32KB. |
| `video_duration_seconds` | integer \| null | 0–600 |
| `video_notes` | string \| null | Max 1000 chars |

**Response 200** — `{ "tag": { ...full UserTag with new metadata } }`

**Errors**
- 400 — no fields provided, or any field validation failure (with reason)
- 404 — tag not found or not owned

### DELETE `/api/user-tags/:id` ✅

Delete a tag from the user's library. Note: this leaves orphan IDs in `training_sessions.user_tag_ids` arrays — the frontend filters them out at display time.

**Response 200**
```json
{ "message": "Tag deleted." }
```

**Errors**
- 404 — tag not found or not owned

---

## Canonical Position Routes

All routes require `Authorization: Bearer <token>`. Base path: `/api/canonical-positions`.

The canonical library is a curated, read-only global vocabulary of ~60 BJJ positions seeded in migration 012. There are no write endpoints — additions/edits land via new migrations or future admin tooling. `TagPicker` fetches this list once per session and searches it (alongside the user's private `user_tags`) for autocomplete, with alias matching so "DLR" resolves to "De La Riva" before save.

### GET `/api/canonical-positions` ✅

Returns the full canonical library, alphabetised by name. Cached aggressively (ETag + `Cache-Control: private, max-age=3600`) since the data changes only via migration.

**Query params**
| Param | Type | Notes |
|---|---|---|
| `pillar` | string | Optional. One of `standup` / `passing` / `pins` / `submissions` / `guard` — restricts results to that pillar. Unknown values are ignored (full list returned). |

**Response 200**
```json
{
  "positions": [
    {
      "id": "uuid",
      "name": "De La Riva",
      "parent_pillar": "guard",
      "aliases": ["DLR", "de la hiva", "dlr guard"],
      "created_at": "2026-04-21T12:00:00.000Z"
    }
  ]
}
```

**Response 304** — if the client's `If-None-Match` matches the current ETag, returns 304 with no body.

**Caching:** ETag is a SHA-1 hash of `id:name` joined across all rows; only changes when the table is mutated (migration). Frontend `useCanonicalPositions()` hook also caches the result via a module-level promise so all components share one fetch per page load.

---

## Class Schedules

User-defined recurring class times. The notification scheduler reads from this table to fire the three pings per class (pre-class T-30, intention-check T+0, drive-home T+8).

### `GET /api/class-schedules`
Auth required. Returns the active schedule rows ordered by `(day_of_week, start_time)`.

**Response 200:**
```json
{ "schedules": [ { "id": "uuid", "user_id": "uuid", "name": "Tue Night BJJ", "day_of_week": 2, "start_time": "19:00:00", "duration_min": 90, "gi_nogi": "gi", "is_active": true, "created_at": "..." } ] }
```

### `POST /api/class-schedules`
Auth required. Creates one row per (user, day-of-week) slot.

**Body:**
```json
{ "name": "Tue Night BJJ", "day_of_week": 2, "start_time": "19:00", "duration_min": 90, "gi_nogi": "gi" }
```
- `day_of_week`: 0=Sun … 6=Sat
- `start_time`: `HH:MM` or `HH:MM:SS` (user-local clock)
- `duration_min`: 15–480
- `gi_nogi`: `gi` / `no_gi` / null

Returns 201 `{ schedule }`.

### `PATCH /api/class-schedules/:id`
Auth required. Replaces all editable fields. Same body shape as POST. Returns 200 `{ schedule }`, or 404 if not owned.

### `DELETE /api/class-schedules/:id`
Auth required. **Soft-delete** (sets `is_active = false`). Returns 204.

---

## Push Subscriptions

Web Push subscription registry — one row per browser-device install. Per-category opt-in flags so users can mute one kind of ping without losing the subscription.

### `GET /api/push-subscriptions/vapid-public-key`
**Public** (no auth). Returns the VAPID public key for `pushManager.subscribe()`.

**Response 200:** `{ "vapidPublicKey": "BJ..." }`
**Response 503:** push is not configured (server is missing VAPID env vars).

### `GET /api/push-subscriptions/me`
Auth required. Returns whether *any* of the current user's subscriptions exist plus the unified per-category flags.

**Response 200:**
```json
{ "subscribed": true, "categories": { "pre_class": true, "intention_check": true, "drive_home_log": false } }
```

### `POST /api/push-subscriptions`
Auth required. Idempotent upsert keyed on `endpoint`. Re-subscribing the same browser refreshes `last_seen` without changing per-category flags.

**Body:**
```json
{ "endpoint": "https://push.apple.com/...", "keys": { "p256dh": "...", "auth": "..." }, "user_agent": "iPhone 15 / iOS 17.4 PWA" }
```
Returns 201 `{ subscription: { id, pre_class, intention_check, drive_home_log } }`.

### `PATCH /api/push-subscriptions/categories`
Auth required. Apply per-category flags across all of the user's subscriptions (mobile + tablet behave as a single preference).

**Body:** any subset of `{ pre_class, intention_check, drive_home_log }` as booleans.
**Response 200:** `{ categories: { pre_class, intention_check, drive_home_log } }` (the merged final state).

### `DELETE /api/push-subscriptions`
Auth required. Removes the row matching `endpoint` (this device only).

**Body:** `{ "endpoint": "https://push.apple.com/..." }`
Returns 204.

---

## Profile (Timezone)

### `PATCH /api/profile/timezone`
Auth required. Syncs the user's IANA timezone (e.g. `America/Los_Angeles`). Synced on first load of the schedules page using `Intl.DateTimeFormat().resolvedOptions().timeZone`.

**Body:** `{ "timezone": "America/Los_Angeles" }`
**Validation:** rejected with 400 if the string fails `new Intl.DateTimeFormat(undefined, { timeZone })`.
**Response 200:** `{ "timezone": "America/Los_Angeles" }`

---

## Profile (Onboarding)

### `POST /api/profile/onboarding-complete`
Auth required. Sets `users.onboarding_completed_at = NOW()` so the frontend's onboarding gate stops redirecting the user back into the guided flow. Idempotent — calling it twice is a no-op (the SQL filters on `onboarding_completed_at IS NULL`). Migration 022.

**Body:** `{}` (empty)
**Response 200:** `{ profile: { ...full profile object including onboarding_completed_at } }`

---

## Known Gaps ⚠️

| Issue | Severity | Notes |
|---|---|---|
| No PATCH for sessions | Low | `date` cannot be changed post-creation (not a practical need) |
| No PATCH for intention fields | Low | `intent_label`, `intent_category`, `duration_days` cannot be changed after creation |
| No Traction formula display | Low | Phase 2 — `resonance` is stored but the Traction metric (objective alignment × 0.7 + subjective resonance × 0.3) is not yet computed or surfaced in Analytics |
| No pagination | Low | All sessions/intentions returned in one response |
| No server-side logout | Low | JWT cannot be revoked before 24h expiry |
| No dedicated `/health` endpoint | Low | `GET /` serves as a smoke test (`SELECT 1` + returns `{status:'ok'}`) but there is no `/health` or `/status` route |

---

## Support cases (mig 023)

User-facing endpoint that any authed user can hit from the "Report a Problem"
modal on the profile page. Admin endpoints live under `/api/admin/*` and
are gated by `requireAdmin`.

### `POST /api/cases`

Auth: `verifyToken` (any authed user).

Request body:
```json
{
  "subject":     "Can't save a session",
  "description": "...",
  "page_url":    "https://.../atlas",
  "user_agent":  "Mozilla/5.0 ...",
  "app_version": "abc1234"
}
```

Response: `201 { case: SupportCase }`. Case stored at `status='open',
severity='normal'`. Auto-context fields (page_url, user_agent, app_version)
are captured silently by the client at submit time.

---

## Admin endpoints (mig 023)

Auth: `verifyToken` + `requireAdmin`. Non-admins get 403.

### `GET /api/admin/stats`

Single-row aggregate over 24h / 7d windows. Returns:
```json
{ "stats": {
  "total_users": 42, "users_24h": 1, "users_7d": 5,
  "total_sessions": 1820, "sessions_24h": 18, "sessions_7d": 95,
  "cases_open": 2, "cases_in_progress": 1
} }
```

### `GET /api/admin/cases?status=open|in_progress|closed`

Lists cases joined with the submitting user's email + name. Status filter
optional. Ordered newest-first. Response: `{ cases: SupportCaseWithUser[] }`.

### `PATCH /api/admin/cases/:id`

Body fields all optional: `status`, `severity`, `admin_notes`. Status flip
to `closed` auto-stamps `closed_at`; flip away clears it. 404 if id not
found. Response: `{ case: SupportCase }`.

### `GET /api/admin/users`

Last 50 signups + their session counts and last-session timestamps.
Response: `{ users: AdminUserSummary[] }`.
