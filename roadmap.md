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
| `[x]` | **Streaks & consistency stats** | Current streak + longest streak computed in `computeStats` (`TrainingHeatmap.tsx`). Both surface in `StatStrip`: streak cell shows "best: Xd" sub-label, or "personal best" when current streak equals all-time best in the loaded window. |
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

## Animation & Motion

Full diagnostic rationale and implementation detail for each item lives in `implementation-plans.md → Animation Quality — Compositor-Safe Refactor`.

| Status | Area | Description |
|---|---|---|
| `[x]` | **BeltDateBanner — single-element reveal** | Replace 9-slat Venetian Blind (9 independent 3D compositing layers, visible seams) with a single `scaleX(0→1)` reveal from `transform-origin: left center`. Same emotional beat, zero seams. |
| `[x]` | **BeltBar tails — scaleY instead of height** | `j2TailL` / `j2TailR` animate `height` (triggers layout recalc every frame). Replace with `scaleY(0→1)` from `transform-origin: top center` — compositor-only, same visual. |
| `[x]` | **Shimmer — translateX instead of backgroundPosition** | `j2-shimmer` keyframe updated to `translateX(-200%→200%)` — compositor-safe. Apply to a positioned child element inside an `overflow:hidden` parent. |
| `[x]` | **Today-pulse — drop borderColor animation** | `j2-today-pulse` now pulses `boxShadow` only. Border color is static (`rgba(196,145,95,0.7)`) — no repaint per frame. |
| `[x]` | **Centralize particle keyframes** | `j2IntentParticleRise`, `j2IntentYellowPulse`, `j2IntentPurplePulse`, `j2IntentCopperPulse`, `j2IntentFadeIn`, `j2RouletteEdgeBounce` moved to `tailwind.config.ts`. `<style>` blocks removed from `PathAheadPage` and `SessionDetailModal`. |

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
| `[x]` | **Remove `findUserById` (userModel)** | Exported but never called by any controller or route. Dead code. |
| `[x]` | **Remove `badge.tsx` (ui component)** | `frontend_app/src/components/ui/badge.tsx` — never imported anywhere. Dead shadcn artifact. |
| `[x]` | **Remove `CARD_SURFACE` token** | `theme.ts` exports `CARD_SURFACE` marked `@deprecated` — zero usages. Delete it. |

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
| `[x]` | **Intention always anchors to Monday** | `SetIntentionModal` now initializes `startDate` to today and exposes a date picker in create mode. `activeIntention` lookup in `PathAheadPage` uses a window-range check (`todayStr >= start && todayStr <= end`) rather than Monday matching. |
| `[ ]` | **No future-week intention setting** | The modal always targets the current ISO week. No flow for setting next week's intention in advance — a common need for competition prep. |
| `[ ]` | **Single active intention per week** | `activeIntention` is a `find()` against current-week start — only one intention surfaces on the home page even if multiple exist for the same week in the DB. |
| `[ ]` | **Journal autosave not offline-safe** | `JournalEntryPage` calls `api.patch` directly, bypassing the offline write queue. Entries typed while offline are silently lost. Route through the existing offline queue or at minimum warn the user when offline. |

---

## Easter Eggs & Character

A subtle thematic tribute to a character whose ethos aligns with BJJ culture: pure hard work, zero shortcuts, mastery through repetition. All features reference universal concepts (numbers, colors, philosophy) — no character names or images.

| Status | Area | Description |
|---|---|---|
| `[x]` | **Session 500 milestone toast** | When a user logs their 500th total session, a one-time toast fires: "500 sessions. The mat remembers every one." Backend returns `session_count` with the create-session response. Fires once via `localStorage` flag `j2-milestone-500`. |
| `[ ]` | **Eight Gates — streak milestone system** | At streak thresholds 7, 14, 21, 30, 60, 90, 180, 365 days, the streak number's color and glow scale progressively (copper → green → gold). A one-time toast fires per tier, stored in localStorage. At 365 days: particle burst. |
| `[ ]` | **Foundation Reps — Rep Roulette filter** | Add a `tier: 'foundation' \| 'chain'` field to `ROULETTE_DRILLS` in `constants.ts`. A "Foundation ✿" filter tab in Rep Roulette surfaces only the 6 pure-movement drills (hip escape, tech stand-up, etc.). |
| `[x]` | **"Presence" intention category** | Added as sixth category in `SetIntentionModal`. Color: `#52B56C` (mat green, distinct from all other categories). For weeks where the goal is simply to show up and be present on the mat. |
| `[ ]` | **Full Commitment hours stat** | Extend `computeStats()` with `fullEffortMinutes` (intensity 4–5 only). Display as a secondary stat alongside total hours. |
| `[ ]` | **The Drop — PR particle effect** | On logging a personal record (longest session, first intensity-5, or Nth milestone), small circle "weights" animate briefly downward. Uses existing particle system in `particles.ts`. |

---

## Design Decision: No Badge/Achievement Gallery

**Verdict: build milestone moments, not a badge collection.**

A traditional badge system (profile tab, earned/unearned icon grid, "collect them all" UI) would work against the app's ethos — it optimizes for logging volume and creates a side quest that distracts from actual training. It also conflicts with the "hard work for its own sake" philosophy that the Easter Eggs section embodies.

The right pattern is **milestone moments**: contextual, one-time events that fire once, say something true, and disappear. The session-500 toast and the planned Eight Gates streak system are both this shape — they upgrade existing displays or fire a single toast, with no persistent badge inventory UI needed.

**Milestones worth building (when the time comes):**
- First 100 hours on the mat
- First 90-day streak
- First intensity-5 session logged
- 12 consecutive weeks with 3+ sessions (consistency, not raw streak)
- Drilling-to-sparring ratio crosses a meaningful threshold

None of these need a badge UI. They need a localStorage flag, a one-time toast, and possibly a subtle visual tweak to an existing stat. Extend the Eight Gates pattern, don't add a new UI paradigm.
