# Journada — Roadmap

Development areas identified from codebase assessment. Updated as work progresses.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Quality & Infrastructure

| Status | Area | Description |
|---|---|---|
| `[~]` | **Testing** | No automated tests exist. Add Vitest backend suite covering auth flow, session validation, and JWT middleware. Frontend component tests to follow. |
| `[ ]` | **Pagination on session fetch** | `GET /api/sessions` returns the user's full history in a single payload. Add `?year=` or `?limit=&offset=` to avoid growing load times as session count grows. |
| `[ ]` | **PWA / offline support** | Add a service worker + web manifest so the app is installable and survives spotty gym WiFi when logging sessions. |

---

## Performance

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Session data scoping** | Related to pagination: scope Calendar and Analytics fetches to the relevant year/window rather than loading all sessions on every page mount. |

---

## Features: Training Insights

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Streaks & consistency stats** | Consecutive days trained, current streak, longest streak. High-motivation metric for BJJ athletes. Slot into Path Ahead page or a dedicated stats card. |
| `[ ]` | **Goal tracking** | Set a weekly or monthly mat-hours target. Show progress toward it on the Path Ahead summary card (e.g. "4.5 of 6h goal"). |
| `[ ]` | **Analytics custom date range** | Extend SkillRadar beyond 30/60/90/All with a date-range picker for analyzing competition prep blocks or specific periods. |
| `[ ]` | **Session notes search** | Full-text search across session notes (PostgreSQL `tsvector` or simple `ILIKE`). Useful for finding technique notes from months ago. |

---

## Features: Competition & History

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Tournament record** | Log competition results: event name, weight class, wins/losses. The `competition_training` session type exists but there's no competition results model. |
| `[ ]` | **Belt rank milestones** | Timeline of when each belt/stripe was achieved, either inferred from profile change history or manually entered. Show on Profile ("Blue belt for 14 months"). |
| `[ ]` | **Positional sparring tracker** | Quick-log specific positions trained (e.g. "20 min closed guard top"). Complements existing session tags with finer granularity. |

---

## Features: Social & Engagement

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Push notifications / reminders** | "You haven't logged in 5 days" or "Set your intention for this week." Web Push API, or a simple email digest via the existing Nodemailer service. |
| `[ ]` | **Coach notes / video links** | Attach a YouTube link or coach note to a session or intention. Could use the existing `notes` field with a structured prefix, or a separate DB field. |
