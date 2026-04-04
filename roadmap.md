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
| `[x]` | **PWA / offline support** | Installable PWA with Workbox service worker (vite-plugin-pwa), web manifest + icons, IndexedDB offline write queue with auto-sync on reconnect, offline UI indicators (`OfflineBanner` + sync toasts), application-level read cache (IndexedDB, 24h expiry) for data persistence across offline navigation, optimistic pending sessions (sessions logged offline appear immediately in UI via localStorage + `usePendingSessions` hook). |

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

## Code Health & Cleanup

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Consolidate duplicate types** | `Intention`, `SessionsResponse`, `IntentionsResponse`, `ProfileResponse` are each defined in 3–6 files. Create `src/types/api.ts` as single source of truth. |
| `[ ]` | **Consolidate duplicate constants** | `CATEGORY_COLORS` and `MONTH_NAMES` are copy-pasted across 4 files each. Move to `src/lib/constants.ts`. |
| `[ ]` | **Delete DashboardPage.tsx** | Legacy page, not routed (replaced by PathAheadPage + CalendarPage + AnalyticsPage). `/dashboard` already redirects to `/home`. |
| `[ ]` | **Split PathAheadPage.tsx** | 1,170+ lines. Extract `DayCard` to `src/components/DayCard.tsx` and particle animation helpers to `src/lib/particles.ts`. |
| `[ ]` | **Add useOnlineRefetch to ProfilePage** | ProfilePage directly calls `api.get` in useEffect but doesn't refetch on reconnect. All other data-fetching pages use `useOnlineRefetch`. |

---

## Features: Social & Engagement

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Push notifications / reminders** | "You haven't logged in 5 days" or "Set your intention for this week." Web Push API, or a simple email digest via the existing Nodemailer service. |
| `[ ]` | **Coach notes / video links** | Attach a YouTube link or coach note to a session or intention. Could use the existing `notes` field with a structured prefix, or a separate DB field. |


