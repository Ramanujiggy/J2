# Journada — Roadmap

Development areas identified from codebase assessment. Updated as work progresses.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Quality & Infrastructure

| Status | Area | Description |
|---|---|---|
| `[~]` | **Testing** | Vitest backend suite exists (auth, sessions, JWT middleware) + Husky pre-commit hook configured. ⚠️ Currently failing — fixture/mock setup incomplete. Fix before next release. |
| `[ ]` | **Password reset token hashing** | Reset tokens are stored in plaintext. Hash with SHA-256 before insert; compare hash on validation. Prevents account takeover if the `password_reset_tokens` table is ever exposed. |
| `[~]` | **Frontend testing** | React Testing Library test files started (`HomePage.test.tsx`, `LogSessionForm.test.tsx`, `PathAheadPage.swipe.test.tsx`). More coverage needed: CalendarPage, auth flow, SessionDetailModal. |
| `[x]` | **Pagination on session fetch** | `GET /api/sessions` supports optional `?from` and `?to` date params (YYYY-MM-DD). CalendarPage scopes to the selected year; AnalyticsPage scopes to the active time window (30/60/90d); PathAheadPage scopes to a precise 11-day carousel window (today ± 5 days) — constant payload regardless of history length. Full session history is never loaded in a single payload. |
| `[x]` | **PWA / offline support** | Installable PWA with Workbox service worker (vite-plugin-pwa), web manifest + icons, IndexedDB offline write queue with auto-sync on reconnect, offline UI indicators (`OfflineBanner` + sync toasts). |

---

## Performance

| Status | Area | Description |
|---|---|---|
| `[x]` | **Session data scoping** | CalendarPage fetches scoped to selected year (`?from&to`); AnalyticsPage fetches scoped to active time window (`?from`). Sessions re-fetched when year/window changes. |

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


