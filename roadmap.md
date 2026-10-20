# Journada — Roadmap

Development areas identified from codebase assessment. Updated as work progresses.

**Status key:** `[ ]` not started · `[~]` in progress · `[x]` done · `[-]` cut (decided against; see Product Focus)

---

## Product Focus (decided 2026-10-20)

**The one job:** Journada makes it effortless to keep an honest record of your jiu jitsu, and gives that record back to you in a way that means something. Every feature serves **capture** or **reflection**, or it is not core. Full reasoning: [Product Thesis](https://claude.ai/code/artifact/5eae3fe3-3fe6-4b0f-97d7-4123f9c30001).

**The moat is the record**, built in layers: the record → reflection → insight from your own words → insight from video. Video analytics is a research bet that only pays off on top of a deep record; pose analysis runs as a short experiment on mixed-angle footage before any further investment.

**Feature rules** (a feature passes all five or waits):
1. It makes capture easier or the record richer, or gives the record back meaningfully.
2. The builder would use it this month.
3. It adds dignity to the record: no streak pressure, ranking, optimizing or nagging.
4. Capture works on a phone, after class, in under a minute.
5. Insight features stand on data that already exists.

| Call | Items |
|---|---|
| **Core** | Frontend testing · E2E for the log-a-session journey in CI · Intention alignment heuristic · Single active intention per week · Belt rank milestones · Coach notes / video links · First-run onboarding *(new)* · "On this day" resurfacing *(new)* · Video: filming guide *(new)* · Video: tap to pick the pair + skeleton overlay *(new)* |
| **Later** | Future-week intentions · Tournament record · Position model training (gated on the pose experiment) · Eight Gates × Intention · Foundation Reps filter · Gold `@mention` styling |
| **Cut** | Goal tracking · Push reminders · Positional sparring tracker · Full Commitment hours stat · The Drop PR effect |

Cut items stay in their tables marked `[-]` with the reason, so the decision is not re-litigated.

---

## Quality & Infrastructure

| Status | Area | Description |
|---|---|---|
| `[x]` | **Testing — backend** | Vitest backend suite (auth, sessions, JWT middleware) + Husky pre-commit hook. 150 passing, 9 skipped (159 total) across 11 test files; all passing as of 2026-10-06 (`cd backend_api && npx vitest run`). |
| `[x]` | **Password reset token hashing** | Reset tokens are stored as SHA-256 hashes. Raw token travels only in the email link; DB never holds the plaintext token. |
| `[x]` | **Frontend testing** | 139 vitest tests passing as of 2026-10-20 (`cd frontend_app && npx vitest run`), run in CI on every PR. The riskiest untested code is now covered: `offlineQueue.ts` (enqueue, ordering, retry, drop) and `api.ts` (offline enqueue, read cache fallback). Still worth adding later: `SessionDetailModal`, hooks, a shared render wrapper with providers. |
| `[x]` | **E2E testing (Playwright)** | The core capture journey runs in CI on every PR (`e2e` job, `frontend_app/playwright/ci/first-entry.spec.ts` against a fresh Postgres): sign up → onboarding → write a first entry with a video link → read it → edit → delete. The older suites (`e2e/`, `frontend_app/playwright/tests/`) stay local-only and unverified; consolidating them, and adding profile updates, is Later. |
| `[x]` | **First-run onboarding** | Verified 2026-10-20: already built. `OnboardingGate` (`App.tsx`) sends anyone without `onboarding_completed_at` through Welcome ("A quiet place for your training.") → name → belt → a first entry in the real composer with a Prism coachmark → done. No further work needed before others start using the app. |
| `[x]` | **CI/CD pipeline** | `.github/workflows/ci.yml` runs on every push and PR (JOU-4). Two jobs — `backend_api` and `frontend_app` — each run `tsc --noEmit` then `vitest run` on Node 24 with `npm ci`. Playwright E2E is **not** yet wired into CI (see E2E row). |
| `[x]` | **Pagination on session fetch** | `GET /api/sessions` supports optional `?from` and `?to` date params (YYYY-MM-DD). CalendarPage scopes to the selected year; AnalyticsPage scopes to the active time window (7D–1Y or custom range); PathAheadPage fetches 168 days back (covers the 24-week heatmap preview widget) through 5 days ahead — full session history is never loaded in a single payload. |
| `[x]` | **PWA / offline support** | Installable PWA with Workbox service worker (vite-plugin-pwa), web manifest + icons, IndexedDB offline write queue with auto-sync on reconnect, offline UI indicators (`OfflineBanner` + sync toasts), application-level read cache (IndexedDB, 24h expiry) for data persistence across offline navigation, optimistic pending sessions (sessions logged offline appear immediately in UI via localStorage + `usePendingSessions` hook). |

> **On the test counts above.** The backend/frontend numbers are a point-in-time snapshot (last verified 2026-10-06) and drift with every commit. The authoritative, always-current source is CI (`.github/workflows/ci.yml`), which runs both `vitest` suites on every push and PR. Treat the CI run on a given commit as truth; the figures here are a convenience, not the record. When you touch this file, re-run `npx vitest run` in each package and update the date, or replace the exact counts with "see CI" rather than leaving a stale number in place. The unavoidable next drift is the E2E figures, which nothing runs automatically.

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
| `[-]` | **Goal tracking** | **Cut 2026-10-20: mat-hour targets are productivity framing; they measure volume, not the journey.** Original idea: Set a weekly or monthly mat-hours target. Show progress toward it on the Path Ahead summary card (e.g. "4.5 of 6h goal"). |
| `[x]` | **Analytics custom date range** | `TimeRangeBar` component provides 7D/14D/30D/90D/180D/1Y presets plus a custom date-range picker (start + end date inputs). |
| `[x]` | **Session search + filter** | `GET /api/sessions/search` endpoint with ILIKE text search + filter chips (gi/nogi, type, pillar, intensity). `SessionSearchPanel` integrated into CalendarPage behind a search toggle. Offline fallback via `filterSessionsLocal`. |
| `[x]` | **"On this day" resurfacing** | Built 2026-10-20. Home's memory chain now reaches any earlier year on this day ("3 years ago today"), nearest year first, before falling back to the same month last year. A promotion tied on this day in an earlier year leads the hero deck as its own card (belt name, the words written that day, "Read it" when the promotion is linked to an entry). `findPromotionAnniversary()` / `AnniversaryCard`. |
| `[x]` | **CSV data export** | `exportSessionsCsv()` and `exportIntentionsCsv()` on ProfilePage using PapaParse. Human-readable column headers, chronological sort. Mirrors the existing CSV import for data symmetry / trust. |

---

## Features: Competition & History

| Status | Area | Description |
|---|---|---|
| `[ ]` | **Tournament record** | Log competition results: event name, weight class, wins/losses. The `competition_training` session type exists but there's no competition results model. |
| `[x]` | **Belt rank milestones** | Built: `belt_history` (migrations 038–039) with one row per rank+stripes, the promotion sheet and reveal ceremony, a removable promotions list on Profile, and promotions as entries in the journal stream. 2026-10-20 added time at the current belt under the belt on Profile ("Tied on March 2025 · 1 year, 7 months at this belt") via `timeAtBeltLabel()` in `lib/belt.ts`. |
| `[-]` | **Positional sparring tracker** | **Cut 2026-10-20: more fields to fill at log time; position tags on footage already cover it.** Original idea: Quick-log specific positions trained (e.g. "20 min closed guard top"). Complements existing session tags with finer granularity. |

---

## Features: Session Video & Position Tagging

| Status | Area | Description |
|---|---|---|
| `[x]` | **Session video upload** | `SessionVideoBlock.tsx` — upload rolling footage to Cloudflare R2 per session. Signed URL upload with XHR progress reporting. `sessionVideoController.ts` + `sessionVideoModel.ts` + migration `040_session_videos.sql`. |
| `[x]` | **Video transcoding worker** | `transcodeWorker.ts` — background job converts raw uploads to HLS for browser playback. Status polling in the UI (`pending → processing → ready → error`). |
| `[x]` | **Position tagger** | `PositionTagger.tsx` — 17-position BJJ taxonomy (7 top, 7 bottom, 3 neutral) with a timeline scrubber. Tag time segments with position labels. Saves `position_segments` with `source: 'manual'`. |
| `[x]` | **Tagger overlay — mobile UX** | Full-screen portal overlay (z-60) with spring slide-up/slide-down animation (Framer Motion). Tap footage card on mobile to open; "Tag positions" / "Re-tag" button on desktop. Session strip tappable to dismiss. |
| `[ ]` | **Filming guide** | Core (Product Focus). Short in-app guide shown before a first upload: phone on a small tripod, side-on, waist height, one pair, 3–5 m away. The 2026-10-20 pose experiment showed distance and gym clutter are the biggest failure causes. |
| `[ ]` | **Tap to pick the pair + skeleton overlay** | Core (Product Focus). On upload the user taps themselves and their partner on the first frame; a background job tracks those two through the roll and stores per-frame skeletons, shown as an overlay during review. In testing, YOLO11-pose found two clean skeletons in 96–98% of close frames but often paired the wrong people, which the tap fixes. Production must use RTMPose/RTMO (Apache-2.0), not Ultralytics (AGPL). |
| `[ ]` | **Position model training** | Later — gated on 300+ tagged segments that carry stored skeletons (see the tap-to-pick item). Train a small classifier on the user's own tagged skeletons and pre-fill `position_segments` with `source: 'model', confirmed: false` for the user to accept or fix. Research (2026-10-20, [write-up](https://claude.ai/code/artifact/a721ac57-2197-42b5-ab0c-4407f14022b6)): public models fall to ~30% accuracy on everyday phone footage and recover with the athlete's own labels, so the tagger is the data engine. **Pose library decision (revised):** MediaPipe Pose failed on close grappling (both athletes found in 15–43% of frames, merged skeletons). Use RTMPose/RTMO; the ViCoS BJJ dataset is CC BY-NC-SA, so prototype-only. |

---

## Performance & Polish

| Status | Area | Description |
|---|---|---|
| `[x]` | **Framer Motion page transitions** | `PageTransition.tsx` rewritten with `AnimatePresence` + spring physics. Exit: 140ms ease-in fade-up. Enter: ~260ms spring settle (stiffness 380, damping 34). Replaced manual timer/phase state machine. |
| `[x]` | **Optimistic session mutations** | `SessionsContext` exposes `applyAdd` / `applyUpdate` / `applyRemove` alongside `refresh()`. Callsites can update local state instantly before the network responds. |
| `[x]` | **Vendor chunk splitting** | Vite `manualChunks`: `vendor-react`, `vendor-motion`, `vendor-gsap`. Stable library code cached separately from app code across deploys. |

---

## Homepage Redesign

Competitive audit against Strong, Strava, Nike TC, Peloton identified gaps in information architecture. All items resolved as of 2026-10-11 — the home was redesigned more broadly than originally planned.

| Status | Area | Description |
|---|---|---|
| `[x]` | **Rep Roulette → FAB + bottom sheet** | Shipped `e6beb9e`. `RepRouletteFab.tsx` portal-rendered bottom sheet; inline section removed from PathAheadPage (~180 lines). |
| `[x]` | **Primary CTA above the fold** | Resolved by home redesign. StatStrip, week carousel, and intention card moved to Profile/Atlas. Home is now greeting row → HERO card — the log CTA is the HERO in every state (DayOneCard, NothingToResurfaceCard, MemoryCard). Never buried. |
| `[x]` | **Training Telemetry hidden-panel UX** | Resolved by home redesign. StatStrip and TelemetryCard no longer on home — live on Profile where they're contextually expected as identity/history data. |
| `[x]` | **Mobile scroll depth** | Resolved by home redesign. Mobile home is now: greeting row + HERO card + entry list + portrait. Well within 1.5x viewport on a 390px screen. |

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
| `[-]` | **Push notifications / reminders** | **Cut 2026-10-20: "you haven't logged in N days" is nagging. A gentle weekly intention prompt may return later as its own item.** Original idea: "You haven't logged in 5 days" or "Set your intention for this week." Web Push API, or a simple email digest via the existing Nodemailer service. |
| `[x]` | **Coach notes / video links** | Built 2026-10-20, no schema change. Links pasted into an entry now render as links in the read view, and YouTube links (watch, youtu.be, shorts) are listed under the prose as "Linked video" rows (`lib/entryLinks.ts`, `EntryReadView`). Coach notes stay in the entry itself rather than a separate field: one more field at log time breaks the under-a-minute capture rule. |
| `[ ]` | **Gold `@mention` styling in the entry prose** | Deferred 2026-07-25. Color partner `@mentions` copper in the Margin Notes entry so tags stand out. A `<textarea>` can't style part of its text; approach chosen = **highlight-overlay** (mirror div behind a transparent-text textarea colors each `@Ash`; keeps the textarea so voice/mobile/caret stay bulletproof — the `@` stays visible). `contenteditable` was rejected as too fragile for this voice-fed mobile input. Single file: `MarginNotesEntry.tsx`. |

---

## Features: Intentions

| Status | Area | Description |
|---|---|---|
| `[x]` | **Alignment heuristic too naive** | Resolved (verified 2026-10-20): migration 007 added `heading` to intentions and `SetIntentionModal` requires a pillar before saving, so `computeAlignment()` compares heading to the top-trained pillar and scores the share of hours on-heading. The word-overlap path only runs for legacy intentions created before 007. |
| `[x]` | **Intention always anchors to Monday** | `SetIntentionModal` now initializes `startDate` to today and exposes a date picker in create mode. `activeIntention` lookup in `PathAheadPage` uses a window-range check (`todayStr >= start && todayStr <= end`) rather than Monday matching. |
| `[ ]` | **No future-week intention setting** | The modal always targets the current ISO week. No flow for setting next week's intention in advance — a common need for competition prep. |
| `[x]` | **Single active intention per week** | Decided 2026-10-20: one intention owns today, by design (a journal holds one focus at a time). Fixed the real defect: five surfaces each picked it differently, and only Home dropped intentions whose session/week target was already met, so Home and the Intentions page could disagree. All now use `pickActiveIntention()` (`analyticsUtils.ts`): covers today, not yet complete, most recently started wins. |
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
| `[-]` | **Full Commitment hours stat** | **Cut 2026-10-20: an intensity score rewards optimizing over honest record-keeping.** Original idea: Extend `computeStats()` with `fullEffortMinutes` (intensity 4–5 only). Display as a secondary stat alongside total hours. |
| `[-]` | **The Drop — PR particle effect** | **Cut 2026-10-20: "personal record" is fitness-app language.** Original idea: On logging a personal record (longest session, first intensity-5, or Nth milestone), small circle "weights" animate briefly downward. Uses existing particle system in `particles.ts`. |

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
