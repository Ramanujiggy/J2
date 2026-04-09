# Journada — Roadmap

Development areas identified from codebase assessment. Updated as work progresses.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Quality & Infrastructure

| Status | Area | Description |
|---|---|---|
| `[~]` | **Testing — backend** | Vitest backend suite exists (auth, sessions, JWT middleware) + Husky pre-commit hook configured. ⚠️ Currently broken — Vitest 4.x requires Node 22+ (`styleText` from `node:util`), system runs Node 20.11.1. Fix: upgrade Node to v22 LTS or downgrade Vitest to 3.x. |
| `[ ]` | **Password reset token hashing** | Reset tokens are stored in plaintext. Hash with SHA-256 before insert; compare hash on validation. Prevents account takeover if the `password_reset_tokens` table is ever exposed. |
| `[~]` | **Frontend testing** | 3 test files (22 tests, all passing): `HomePage.test.tsx`, `LogSessionForm.test.tsx`, `PathAheadPage.swipe.test.tsx`. Coverage ~10%. High-value additions: `api.ts` (offline queue/cache — riskiest untested code), `SessionDetailModal` (complex 3D flip, just had a bug), all hooks, shared test render wrapper with providers. |
| `[~]` | **E2E testing (Playwright)** | 3 spec files (19 tests × 3 viewports): auth UI, visual screenshots, mobile tap regression guards. Core user journeys untested: log session, edit/delete session, set intention, CSV import, profile updates. Also needs: CI/CD workflow, test data cleanup, rate-limit handling. |
| `[ ]` | **CI/CD pipeline** | No GitHub Actions workflow exists. Tests only run manually. Add workflow to run frontend unit tests + Playwright E2E on every PR. |
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
| `[x]` | **Consolidate duplicate types** | Created `src/types/api.ts` as single source of truth for `SessionSummary`, `Intention`, `CalendarIntention`, `SessionsResponse`, `IntentionsResponse`, `ProfileResponse`. All 8 consumer files updated to import from there. |
| `[x]` | **Consolidate duplicate constants** | `CATEGORY_COLORS` and `MONTH_NAMES` moved to `src/lib/constants.ts`. All 4 consumer files updated. |
| `[x]` | **Delete DashboardPage.tsx** | Deleted. 161 lines of dead code removed. |
| `[ ]` | **Split PathAheadPage.tsx** | 1,170+ lines. Extract `DayCard` to `src/components/DayCard.tsx` and particle animation helpers to `src/lib/particles.ts`. |
| `[ ]` | **Add useOnlineRefetch to ProfilePage** | ProfilePage directly calls `api.get` in useEffect but doesn't refetch on reconnect. All other data-fetching pages use `useOnlineRefetch`. |

---

## Features: Social & Engagement

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Push notifications / reminders** | "You haven't logged in 5 days" or "Set your intention for this week." Web Push API, or a simple email digest via the existing Nodemailer service. |
| `[ ]` | **Coach notes / video links** | Attach a YouTube link or coach note to a session or intention. Could use the existing `notes` field with a structured prefix, or a separate DB field. |

---

## Features: Intentions

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Alignment heuristic too naive** | `computeAlignment()` splits label/tag text on 4+ char word boundaries and looks for overlap. High false-diverged rate — "Active Toes" vs "Stand-up" reads as diverged even if standup *is* the intended focus. Replace with an explicit pillar tag on the intention (e.g. select a `heading` when setting intent), or a configurable keyword-to-pillar map. |
| `[ ]` | **Intention always anchors to Monday** | `getWeekStart(today)` always returns the current Monday. A 3-day intention set on Thursday starts Monday, so the window shown doesn't match the actual training window. Fix: use today as `week_start` when `duration_days < 7`, or add a start-date picker to the modal. |
| `[ ]` | **No future-week intention setting** | The modal always targets the current ISO week. No flow for setting next week's intention in advance — a common need for competition prep. |
| `[ ]` | **Single active intention per week** | `activeIntention` is a `find()` against current-week start — only one intention surfaces on the home page even if multiple exist for the same week in the DB. |
| `[ ]` | **Journal autosave not offline-safe** | `JournalEntryPage` calls `api.patch` directly, bypassing the offline write queue. Entries typed while offline are silently lost. Route through the existing offline queue or at minimum warn the user when offline. |


