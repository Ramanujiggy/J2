# API Reference

Base URL: `http://localhost:5000`

All protected endpoints require `Authorization: Bearer <token>` header.

---

## Auth

### `POST /auth/register`

Create a new account.

**Rate limit**: 10 requests / 15 min per IP.

**Body**
```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response `201`**
```json
{
  "message": "User registered successfully.",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

**Errors**: `409` email already taken · `400` missing fields

---

### `POST /auth/login`

Authenticate and receive a JWT.

**Rate limit**: 10 requests / 15 min per IP.

**Body**
```json
{
  "email": "user@example.com",
  "password": "secret"
}
```

**Response `200`**
```json
{
  "message": "Login successful",
  "token": "<jwt>",
  "user": { "id": "uuid", "email": "user@example.com" }
}
```

**Errors**: `401` invalid credentials · `400` missing fields

---

## Sessions

All session endpoints require authentication.

### `POST /api/sessions`

Log a new training session.

**Body**
```json
{
  "date": "2025-03-15",
  "duration": 90,
  "gi_nogi": "gi",
  "intensity": 3,
  "session_type": "class",
  "notes": "Worked guard passing drills",
  "tags": ["guard_passing", "submissions"]
}
```

| Field | Type | Required | Valid values |
|---|---|---|---|
| `date` | string (YYYY-MM-DD) | yes | |
| `duration` | integer (minutes) | yes | |
| `gi_nogi` | string | yes | `gi`, `no_gi` |
| `intensity` | integer | yes | 1–5 |
| `session_type` | string | yes | `class`, `drilling`, `competition_training` |
| `notes` | string | no | |
| `tags` | string[] | yes (min 1) | `standup`, `guard_retention`, `submissions`, `pin_escapes`, `guard_passing` |

**Response `201`**
```json
{
  "message": "Session logged.",
  "session": { "id": "uuid", "user_id": "uuid", "date": "2025-03-15", "..." }
}
```

---

### `GET /api/sessions`

Fetch all sessions for the authenticated user, ordered by date descending.

**Response `200`**
```json
{
  "sessions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "date": "2025-03-15",
      "duration": 90,
      "gi_nogi": "gi",
      "intensity": 3,
      "session_type": "class",
      "notes": "…",
      "tags": ["guard_passing"],
      "created_at": "…"
    }
  ]
}
```

---

### `PUT /api/sessions/:id`

Update a session. Only the owning user can update their sessions.

**Body** (all fields required)
```json
{
  "duration": 60,
  "gi_nogi": "no_gi",
  "intensity": 4,
  "session_type": "drilling",
  "notes": "Updated notes",
  "tags": ["standup"]
}
```

**Response `200`**
```json
{
  "message": "Session updated.",
  "session": { "id": "uuid", "..." }
}
```

**Errors**: `404` session not found or not owned by user

---

## Profile

Both endpoints require authentication.

### `GET /api/profile`

Fetch the current user's profile.

**Response `200`**
```json
{
  "profile": {
    "name": "Robert",
    "belt_rank": "blue",
    "stripes": 2,
    "home_gym_name": "Alliance HQ",
    "home_gym_address": "123 Main St, Atlanta, GA",
    "home_gym_place_id": "ChIJ…"
  }
}
```

---

### `PUT /api/profile`

Update profile fields. Validated with Zod; unrecognized fields are stripped.

**Body** (all fields optional)
```json
{
  "name": "Robert",
  "belt_rank": "blue",
  "stripes": 2,
  "home_gym_name": "Alliance HQ",
  "home_gym_address": "123 Main St, Atlanta, GA",
  "home_gym_place_id": "ChIJ…"
}
```

| Field | Valid values |
|---|---|
| `belt_rank` | `white`, `blue`, `purple`, `brown`, `black` |
| `stripes` | 0–4 |

**Response `200`**
```json
{
  "message": "Profile saved.",
  "profile": { "name": "Robert", "belt_rank": "blue", "..." }
}
```

---

## Intentions

All endpoints require authentication.

### `POST /api/intentions`

Set the intention for a given week. Only one intention is allowed per user per week — returns `409` if one already exists (delete it first to set a new one).

**Body**
```json
{
  "intent_label": "Active Toes",
  "intent_category": "technical",
  "week_start": "2025-03-10"
}
```

| Field | Type | Required | Notes |
|---|---|---|---|
| `intent_label` | string | yes | Max 20 characters |
| `intent_category` | string | no | `technical`, `physical`, `mental`, `positional`, `competitive` |
| `week_start` | string (YYYY-MM-DD) | no | ISO Monday for the target week. Defaults to current week's Monday if omitted. Send from client to handle timezone correctly. |

**Response `201`**
```json
{
  "message": "Intention set.",
  "intention": {
    "id": "uuid",
    "user_id": "uuid",
    "week_start": "2025-03-10",
    "intent_label": "Active Toes",
    "intent_category": "technical",
    "created_at": "…"
  }
}
```

**Errors**: `400` missing/invalid fields · `409` intention already exists for this week

---

### `GET /api/intentions`

Fetch all intentions for the authenticated user, ordered by `week_start` descending.

**Response `200`**
```json
{
  "intentions": [
    {
      "id": "uuid",
      "user_id": "uuid",
      "week_start": "2025-03-10",
      "intent_label": "Active Toes",
      "intent_category": "technical",
      "created_at": "…"
    }
  ]
}
```

---

### `GET /api/intentions/current`

Fetch the intention for the current (or specified) week. Returns `intention: null` if none is set.

**Query params**

| Param | Required | Notes |
|---|---|---|
| `week_start` | no | YYYY-MM-DD Monday of the target week. Send from client to handle timezone. Defaults to server's current week. |

**Response `200`**
```json
{ "intention": { "id": "uuid", "intent_label": "Active Toes", "…": "…" } }
```
or
```json
{ "intention": null }
```

---

### `DELETE /api/intentions/:id`

Delete an intention. Only the owning user can delete their intention.

**Response `200`**
```json
{ "message": "Intention deleted." }
```

**Errors**: `404` intention not found or not owned by user

---

## Error Format

All errors return JSON:
```json
{ "message": "Human-readable message" }
```

Common status codes:

| Code | Meaning |
|---|---|
| `400` | Validation error / missing required field |
| `401` | Missing, invalid, or expired JWT |
| `404` | Resource not found or not owned by user |
| `409` | Conflict (e.g. email already registered) |
| `500` | Internal server error |
