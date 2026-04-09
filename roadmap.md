# Journada — Roadmap

Development areas identified from codebase assessment. Updated as work progresses.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Quality & Infrastructure

| Status | Area | Description |
|---|---|---|
| `[x]` | **Testing — backend** | Vitest backend suite (auth, sessions, JWT middleware) + Husky pre-commit hook. 42/42 tests passing on Node v22. |
| `[x]` | **Password reset token hashing** | Reset tokens are stored as SHA-256 hashes. Raw token travels only in the email link; DB never holds the plaintext token. |
| `[~]` | **Frontend testing** | 3 test files (22 tests, all passing): `HomePage.test.tsx`, `LogSessionForm.test.tsx`, `PathAheadPage.swipe.test.tsx`. Coverage ~10%. High-value additions: `api.ts` (offline queue/cache — riskiest untested code), `SessionDetailModal` (complex 3D flip, just had a bug), all hooks, shared test render wrapper with providers. |
| `[~]` | **E2E testing (Playwright)** | 3 spec files (19 tests × 3 viewports): auth UI, visual screenshots, mobile tap regression guards. Core user journeys untested: log session, edit/delete session, set intention, CSV import, profile updates. Also needs: CI/CD workflow, test data cleanup, rate-limit handling. |
| `[ ]` | **CI/CD pipeline** | No GitHub Actions workflow exists. Tests only run manually. Add workflow to run frontend unit tests + Playwright E2E on every PR. |
| `[x]` | **Pagination on session fetch** | `GET /api/sessions` supports optional `?from` and `?to` date params (YYYY-MM-DD). CalendarPage scopes to the selected year; AnalyticsPage scopes to the active time window (7D–1Y or custom range); PathAheadPage fetches 168 days back (covers the 24-week heatmap preview widget) through 5 days ahead — full session history is never loaded in a single payload. |
| `[x]` | **PWA / offline support** | Installable PWA with Workbox service worker (vite-plugin-pwa), web manifest + icons, IndexedDB offline write queue with auto-sync on reconnect, offline UI indicators (`OfflineBanner` + sync toasts), application-level read cache (IndexedDB, 24h expiry) for data persistence across offline navigation, optimistic pending sessions (sessions logged offline appear immediately in UI via localStorage + `usePendingSessions` hook). |

---

## Performance

| Status | Area | Description |
|---|---|---|
| `[x]` | **Session data scoping** | CalendarPage fetches scoped to selected year (`?from&to`); AnalyticsPage fetches scoped to active time window (`?from`). Sessions re-fetched when year/window changes. |
| `[x]` | **ProfileContext listener leak** | `refreshProfile` is wrapped in `useCallback([])` in ProfileContext.tsx — stable reference, no repeated listener registrations. |

---

## Features: Training Insights

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Streaks & consistency stats** | Consecutive days trained, current streak, longest streak. High-motivation metric for BJJ athletes. Slot into Path Ahead page or a dedicated stats card. |
| `[ ]` | **Goal tracking** | Set a weekly or monthly mat-hours target. Show progress toward it on the Path Ahead summary card (e.g. "4.5 of 6h goal"). |
| `[x]` | **Analytics custom date range** | `TimeRangeBar` component provides 7D/14D/30D/90D/180D/1Y presets plus a custom date-range picker (start + end date inputs). |
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
| `[x]` | **Directional swipe navigation** | Pages slide in from right (forward) or left (backward) based on TABS order. Works via swipe on `<main>` and nav tab taps. Rep Roulette protected with `data-no-page-swipe`. |
| `[x]` | **Add useOnlineRefetch to ProfilePage** | ProfilePage now refetches on reconnect via `useOnlineRefetch`, consistent with all other data-fetching pages. |
| `[x]` | **Split PathAheadPage.tsx** | Extracted `DayCard` to `src/components/DayCard.tsx`, particle animation helpers to `src/lib/particles.ts`, and date/session utilities to `src/lib/sessionUtils.ts`. PathAheadPage reduced from 1,385 to ~1,030 lines. |
| `[x]` | **Split SkillRadar.tsx** | Extracted `RadarChart`, `DonutChart`, `VolumeChart`, and `WeeklyChart` into `src/components/charts/`. SkillRadar reduced from 953 to 707 lines — now a pure controller for data computation, view switching, and layout. |
| `[ ]` | **Remove `findUserById` (userModel)** | Exported but never called by any controller or route. Dead code. |
| `[ ]` | **Remove `badge.tsx` (ui component)** | `frontend_app/src/components/ui/badge.tsx` — never imported anywhere. Dead shadcn artifact. |
| `[ ]` | **Remove `CARD_SURFACE` token** | `theme.ts` exports `CARD_SURFACE` marked `@deprecated` — zero usages. Delete it. |

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


