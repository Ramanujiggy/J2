# Journada — Roadmap

Development areas identified from codebase assessment. Updated as work progresses.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done

---

## Quality & Infrastructure

| Status | Area | Description |
|---|---|---|
| `[x]` | **Testing — backend** | Vitest backend suite (auth, sessions, JWT middleware) + Husky pre-commit hook. 150 passing, 9 skipped (159 total) across 11 test files; all passing as of 2026-10-06 (`cd backend_api && npx vitest run`). |
| `[x]` | **Password reset token hashing** | Reset tokens are stored as SHA-256 hashes. Raw token travels only in the email link; DB never holds the plaintext token. |
| `[~]` | **Frontend testing** | 11 test files, 114 tests, all passing as of 2026-10-06 (`cd frontend_app && npx vitest run`): component tests (`HomePage`, `LoginPage`, `PathAheadPage`, `CaptureComposer`) plus lib unit tests (`atlasVerdicts`, `chipExtraction`, `composerKernel`, `homeViewModel`, `journalStream`, `prismGeometry`, `selectionsToDistribution`). High-value additions still missing: `api.ts` (offline queue/cache — riskiest untested code), `SessionDetailModal` (complex 3D flip, just had a bug), all hooks, shared test render wrapper with providers. |
| `[~]` | **E2E testing (Playwright)** | Two Playwright suites as of 2026-10-06: `e2e/` (10 spec files, ~85 `test()` blocks — auth, CSV import, form/intentions/session-detail audits, visual screenshots, usage, interaction) and `frontend_app/playwright/tests/` (3 spec files, 19 `test()` blocks — chip input, first-run hint, intention). Counts are static (grep of `test()` blocks); these numbers were not executed to produce them. As of 2026-10-08 the `frontend_app/playwright/` suite (3 specs) runs in CI via the **nightly + on-demand `e2e` job** (`.github/workflows/ci.yml`, JOU-27) — gated to `schedule`/`workflow_dispatch`, not push/PR, because its 15–25% per-attempt flake would erode the merge signal. The root `e2e/` suite (10 specs) is still local-only. Core journeys still thin on coverage: edit/delete session, profile updates. Also needs: test data cleanup, consolidation of the two suites, and extending CI coverage to the root `e2e/` suite. |
| `[x]` | **CI/CD pipeline** | `.github/workflows/ci.yml`. On every push and PR (JOU-4): two jobs — `backend_api` and `frontend_app` — each run `tsc --noEmit` then `vitest run` on Node 24 with `npm ci`. A third `e2e` job (JOU-27) runs the `frontend_app/playwright/` suite on a **nightly `schedule` + `workflow_dispatch`** only — it stands up Postgres + backend + Vite dev server + Chromium and is kept off push/PR so e2e flakiness never blocks a merge. |
| `[x]` | **Pagination on session fetch** | `GET /api/sessions` supports optional `?from` and `?to` date params (YYYY-MM-DD). CalendarPage scopes to the selected year; AnalyticsPage scopes to the active time window (7D–1Y or custom range); PathAheadPage fetches 168 days back (covers the 24-week heatmap preview widget) through 5 days ahead — full session history is never loaded in a single payload. |
| `[x]` | **PWA / offline support** | Installable PWA with Workbox service worker (vite-plugin-pwa), web manifest + icons, IndexedDB offline write queue with auto-sync on reconnect, offline UI indicators (`OfflineBanner` + sync toasts), application-level read cache (IndexedDB, 24h expiry) for data persistence across offline navigation, optimistic pending sessions (sessions logged offline appear immediately in UI via localStorage + `usePendingSessions` hook). |

> **On the test counts above.** The backend/frontend numbers are a point-in-time snapshot (last verified 2026-10-06) and drift with every commit. The authoritative, always-current source is CI (`.github/workflows/ci.yml`), which runs both `vitest` suites on every push and PR. Treat the CI run on a given commit as truth; the figures here are a convenience, not the record. When you touch this file, re-run `npx vitest run` in each package and update the date, or replace the exact counts with "see CI" rather than leaving a stale number in place. The `frontend_app/playwright/` E2E specs now run nightly in CI (the `e2e` job); the root `e2e/` suite still runs only when someone invokes it locally, so its figures remain the most drift-prone.

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
| `[x]` | **Session search + filter** | `GET /api/sessions/search` endpoint with ILIKE text search + filter chips (gi/nogi, type, pillar, intensity). `SessionSearchPanel` integrated into CalendarPage behind a search toggle. Offline fallback via `filterSessionsLocal`. |
| `[x]` | **CSV data export** | `exportSessionsCsv()` and `exportIntentionsCsv()` on ProfilePage using PapaParse. Human-readable column headers, chronological sort. Mirrors the existing CSV import for data symmetry / trust. |

---

## Features: Competition & History

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Tournament record** | Log competition results: event name, weight class, wins/losses. The `competition_training` session type exists but there's no competition results model. |
| `[ ]` | **Belt rank milestones** | Timeline of when each belt/stripe was achieved, either inferred from profile change history or manually entered. Show on Profile ("Blue belt for 14 months"). |
| `[ ]` | **Positional sparring tracker** | Quick-log specific positions trained (e.g. "20 min closed guard top"). Complements existing session tags with finer granularity. |

---

## Homepage Redesign

Competitive audit against Strong, Strava, Nike TC, Peloton identified gaps in information architecture. The homepage tells a strong narrative (streak → intention → week → history) but has placement issues that hurt flagship-level polish.

| Status | Area | Description |
|---|---|---|
| `[~]` | **Rep Roulette → FAB + bottom sheet** | Roulette breaks the homepage narrative flow (tracking → random drill → history). It's a "sometimes" tool, not an "always" feature. Move to a Floating Action Button (dice icon, lower-right above tab bar) that opens a bottom sheet with the drill card, swipe navigation, and "Log this drill" CTA. Frees ~320px of homepage real estate when expanded, ~48px when collapsed. |
| `[ ]` | **Primary CTA above the fold** | "Log Mat Time" button is buried 400+ pixels below the top on mobile. Every flagship training app (Strong, Peloton, Nike TC) puts the main CTA visible without scrolling. Move to immediately below StatStrip or integrate into the week carousel "today" circle. |
| `[ ]` | **Training Telemetry hidden-panel UX** | Tapping StatStrip to expand Telemetry has no visual affordance — users don't know it's tappable. Either always show Telemetry inline (it's only ~100px) or move it to Analytics where it's contextually expected. |
| `[ ]` | **Mobile scroll depth** | 805px of stacked content on a 390px viewport (2x screen height). Flagship apps target 1.0–1.5x. After moving Roulette to FAB and CTA above fold, reassess whether further section consolidation is needed. |

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
| `[ ]` | **Gold `@mention` styling in the entry prose** | Deferred 2026-07-25. Color partner `@mentions` copper in the Margin Notes entry so tags stand out. A `<textarea>` can't style part of its text; approach chosen = **highlight-overlay** (mirror div behind a transparent-text textarea colors each `@Ash`; keeps the textarea so voice/mobile/caret stay bulletproof — the `@` stays visible). `contenteditable` was rejected as too fragile for this voice-fed mobile input. Single file: `MarginNotesEntry.tsx`. |

---

## Features: Intentions

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Alignment heuristic too naive** | `computeAlignment()` splits label/tag text on 4+ char word boundaries and looks for overlap. High false-diverged rate — "Active Toes" vs "Stand-up" reads as diverged even if standup *is* the intended focus. Replace with an explicit pillar tag on the intention (e.g. select a `heading` when setting intent), or a configurable keyword-to-pillar map. |
| `[x]` | **Intention always anchors to Monday** | `SetIntentionModal` now initializes `startDate` to today and exposes a date picker in create mode. `activeIntention` lookup in `PathAheadPage` uses a window-range check (`todayStr >= start && todayStr <= end`) rather than Monday matching. |
| `[ ]` | **No future-week intention setting** | The modal always targets the current ISO week. No flow for setting next week's intention in advance — a common need for competition prep. |
| `[ ]` | **Single active intention per week** | `activeIntention` is a `find()` against current-week start — only one intention surfaces on the home page even if multiple exist for the same week in the DB. |
| `[x]` | **Journal autosave not offline-safe** | Re-verified 2026-07-23: entries are **not** lost. `api.patch` routes through `request()` in `lib/api.ts`, which catches the failed fetch and parks the write in the IndexedDB queue (`offlineQueue.ts` even dedups repeat PATCHes to the same path specifically for journal autosave); `useOnlineSync` flushes on reconnect. The real defect was reporting: `JournalEntryPage` ignored the synthetic `_offline` payload and displayed a flat "Saved", so a queued-but-unsynced entry looked server-confirmed. Now distinguishes "Saved on this device — will sync when online", matching `LogSessionForm` / `CaptureComposer`. |

---

## Easter Eggs & Character

A subtle thematic tribute to a character whose ethos aligns with BJJ culture: pure hard work, zero shortcuts, mastery through repetition. All features reference universal concepts (numbers, colors, philosophy) — no character names or images.

| Status | Area | Description |
|---|---|---|
| `[x]` | **Session 500 milestone toast** | When a user logs their 500th total session, a one-time toast fires: "500 sessions. The mat remembers every one." Backend returns `session_count` with the create-session response. Fires once via `localStorage` flag `j2-milestone-500`. |
| `[x]` | **Eight Gates — streak milestone system** | At consecutive-week thresholds 2, 4, 6, 8, 12, 16, 20, 26 weeks (2+ sessions/week), the streak cell upgrades in color/glow (copper → amber → green → gold). A one-time toast fires per tier via localStorage flags (`j2-gate-N`). At 26 weeks: particle burst. The streak cell in `StatStrip` is a tappable flip: tap to toggle between daily streak and weekly consistency count (`Xwk`). `computeStats` computes `consistentWeeks` via ISO week bucketing. |
| `[ ]` | **Eight Gates × Intention alignment** | Revisit after Eight Gates ships: weeks that are both consistent AND intention-aligned could amplify the gate reward (brighter glow, extra particle) rather than gate the milestone itself. Blocked on alignment heuristic fix first (see Intentions section). |
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
