# Roadmap

A living document of upcoming work, ordered by priority. Each sprint represents a focused batch of related changes.

**Status key:** ✅ Done · 🔲 Planned · ⚠️ Partial

---

## Sprint 1 — Mobile Polish (Quick Wins)

Small, focused improvements that make the existing UI feel native on mobile. All achievable in a single session each.

| Task | Component | Effort | Notes |
|---|---|---|---|
| Day card scroll snap + `scrollbar-hide` | `PathAheadPage` | Small | `scroll-snap-type: x mandatory` on row, `scroll-snap-align: start` on each card, hide scrollbar on Android Chrome, `overscroll-behavior-x: contain` |
| Modal `max-h` + overflow scroll | All modals | Small | Add `max-h-[90dvh] overflow-y-auto overscroll-contain` to `SessionDetailModal`, `LogSessionForm`, `SetIntentionModal`, `CsvImportModal` |
| LogSessionForm layout fix | `LogSessionForm` | Small | Gi/No-Gi + session type: change `flex gap-6` → `flex flex-col sm:flex-row gap-3 sm:gap-6`; reduce card padding `p-6` → `p-4 sm:p-6` |
| Analytics intent table — mobile cards | `AnalyticsPage` | Small | On mobile, show each row as a stacked card (stated goal on top, ambient focus below) instead of 3-column grid |
| Journal textarea dynamic height | `JournalEntryPage` | Small | Use `calc(100dvh - 260px)` for textarea `min-height` instead of fixed 280px — adjusts for mobile browser chrome |

---

## Sprint 2 — UX Features

User-facing improvements that add meaningful capability with no backend schema changes required.

| Task | Component | Effort | Notes |
|---|---|---|---|
| Edit intention (label / category / duration) | `SetIntentionModal` + API | Medium | Currently read-only after creation. Add a PUT endpoint (`PATCH /api/intentions/:id`) and an edit mode in `SetIntentionModal` or `PathAheadPage` header |
| Intentions: stacked card layout on mobile | `IntentionsPage` | Medium | Replace 4-column grid with a card list on mobile. Card: week label (small), intention category pill + label, ambient focus (copper), journal link |
| Session detail: show all sessions for a day | `SessionDetailModal` | Small | Navigator already exists (`← N of M →`) — ensure today's multi-session days flow naturally from both carousel and list view |
| CompactHeatmap: year forward navigation | `CalendarPage` | Small | Currently year nav only goes backward. Allow forward navigation up to current year. |

---

## Sprint 3 — Dynamic Pillar Engine Phase 2

Phase 1 (schema + backend + form) is complete. Phase 2 surfaces the new data in Analytics and adds derived metrics.

| Task | Notes |
|---|---|
| Traction formula in Analytics | T = (Objective Alignment × 0.7) + (Subjective Resonance × 0.3). Requires comparing `heading` against `intent_label` and incorporating `resonance` score |
| Polarity drill-down on Prism node tap | On tap of a pillar vertex, show offense/defense/neutral breakdown for that pillar |
| Active Heading pulse on Prism | Highlight the active session's `heading` vertex with a copper pulse animation |
| Hit-Rate metric | % of organic sessions (`script_source = 'organic'`) where `heading` matched the active intention's pillar |
| Resonance indicator in `SessionDetailModal` | Show `resonance` score (5-dot display) in the session detail view |
| Resonance column in `IntentionsPage` | Average resonance score per intention period |

---

## Sprint 4 — Infrastructure & Reliability

Technical work that improves stability and developer experience.

| Task | Effort | Notes |
|---|---|---|
| Fix backend test suite | Medium | Fixture/mock setup is incomplete — tests currently fail on run. Fix `auth.test.ts`, `sessions.test.ts`, `jwtMiddleware.test.ts`. |
| Health check endpoint | Small | Add `GET /health` → `{ status: 'ok', db: 'ok', timestamp }`. Run a `SELECT 1` and return DB status. |
| Session pagination | Medium | Add `?limit=N&offset=N` to `GET /api/sessions`. PathAheadPage and CalendarPage already scope by date range so this mainly helps IntentionsPage and AnalyticsPage "All Time" loads. |
| Rate limiting on non-auth routes | Small | Auth routes are rate-limited (10/15min); session/profile/intention routes are unprotected. Add a permissive limiter (e.g. 300/15min) to all `/api` routes. |
| Server-side logout / token revocation | Medium | Client discards token on logout but the JWT remains valid until expiry. Add a `token_blacklist` table or switch to short-lived access tokens + refresh token rotation. |
| Zod validation on all endpoints | Medium | Only profile endpoints use Zod. Standardise across auth, sessions, intentions. |

---

## Sprint 5 — Calendar: Month Accordion View

A significantly better mobile calendar experience than horizontal scroll.

| Task | Notes |
|---|---|
| Month accordion component | Vertical list of 12 month sections. Collapsed: month name + session count + dominant intensity colour bar. |
| Expanded: mini 7-column month grid | Narrow enough to fit on any phone. Click a day → `SessionDetailModal`. |
| Mobile-only switch | `<640px` renders the accordion; desktop keeps `TrainingHeatmap` unchanged. |
| Intention periods in accordion | Show intention label on the relevant week row within each month. |

---

## Sprint 6 — Focus Areas & Adaptive Prism (This Week)

The core idea: **users define their own training focus areas (1–5), not a fixed taxonomy.** The Prism visualization adapts to the count — a single alignment bar for 1, triangle for 3, pentagon for 5. "The Prism is what you earn by having a broad game, not what we impose."

This replaces the old "Custom Pillars" plan (which assumed exactly 5 + hardcoded templates). Focus Areas are freeform, user-count-driven, and set during onboarding. See [Implementations.md](Implementations.md#focus-areas--adaptive-prism) for full design notes.

| Task | Component | Effort | Notes |
|---|---|---|---|
| Onboarding flow: pick focus areas | New `OnboardingFocusPage` | Medium | "What are you working on?" — user types 1–5 freeform labels. No templates, no scaffolding. Shown after first registration or first Analytics visit for existing users. |
| Data model: `focus_areas` on users | Migration + API | Small | `users.focus_areas JSONB` — array of 1–5 `{value, label}` objects. Null = legacy user (falls back to current SKILL_TAGS). |
| Session logging reads user focus areas | `LogSessionForm` | Small | Heading selector reads from profile `focus_areas` instead of hardcoded `SKILL_TAGS`. Backward compat: null focus_areas → default BJJ set. |
| Intentions target a focus area | `SetIntentionModal` | Small | Intent category replaced with (or supplemented by) a focus-area picker. Alignment metrics compare intention target vs session heading. |
| Adaptive Prism visualization | `SkillRadar.tsx` | Medium | 1 area → alignment bar/arc. 2 → split gauge. 3 → triangle. 4 → diamond. 5 → pentagon. Renders from user's focus_areas array. |
| Profile editor for focus areas | `ProfilePage` | Small | Edit/reorder/add/remove focus areas (1–5 cap). Changing areas does not invalidate historical sessions — old headings persist as strings. |
| Easter egg: balanced Prism quote | `SkillRadar.tsx` | Tiny | When all 5 vertices are within 10% of each other, show: "The Prism is what you earn by having a broad game, not what we impose." |

**Design principles:**
- No fixed count. 1–5 focus areas, user's choice.
- No templates or scaffolding. Trust the user to name what matters to them.
- The visualization adapts to the count — shape follows intent.
- Historical sessions retain their heading string even when focus areas change (orphaned headings show as grayed-out "retired" labels).
- Cross-user comparison (future Amaze feature) compares *alignment to stated goals*, not shape. Traction is the universal currency.

**Dependencies:** Pillar Engine Phase 1 (complete)
**Unlocks:** Analytics page redesign (Prism becomes meaningful when it reflects the user's actual game), Meso-Cycle Snapshots (Phase 2, future — focus area transitions get a clean boundary).

---

## Future — Meso-Cycle Snapshots

Builds on Focus Areas. Users can save a named snapshot of their current focus area config + training period as an archived cycle (e.g. "Q1 2026 — Guard Recovery"). Start a new cycle with same or edited focus areas. Cycle History view: shelf of past Prisms with date range, shape, dominant focus. Side-by-side cycle comparison. See [Implementations.md](Implementations.md#meso-cycle-snapshots) for full design notes.

**Dependencies:** Sprint 6 (Focus Areas), D3 Prism migration
**Scope:** Larger lift — cycle archival, history view, comparison UI.

---

## Sprint 7 — iOS Native Foundation (Target: May 2026)

**Goal:** make Journada feel genuinely native on iPhone before launch. Not a rewrite — wrap the existing React/PWA in a Capacitor iOS shell and close the perceptual gap between "website on a phone" and "app." This is the last gate before initial iOS testing and TestFlight readiness.

**Status:** Phase 1 complete (2026-04-25). Phases 2–4 blocked on locating the Mac (Xcode is Mac-only).

**Prerequisites:**
- Mac with Xcode installed (currently blocked)
- Apple Developer Program membership ($99/yr, required for device install + TestFlight)

### Phase 1 — Mechanical native fixes ✅ (2026-04-25)

Pure CSS/markup changes. Improve PWA feel today and are prerequisites for the native shell looking right. **All complete** — see `index.html`, `src/index.css`, and per-file edits below.

| Task | Component | Status | Notes |
|---|---|---|---|
| `viewport-fit=cover` | `index.html` viewport meta | ✅ | Keystone fix. The codebase already had `env(safe-area-inset-*)` calls scattered across AppShell, modals, CalendarPage, PathAheadPage, RepRouletteFab, TimeRangeBar — all silently no-ops until this was added. |
| Safe-area insets on remaining modal | `VideoPlayerModal.tsx` | ✅ | Was the only modal missing `env(safe-area-inset-*)` padding. All others (CsvImportModal, SessionDetailModal, SetIntentionModal) were already correct. |
| Kill tap-highlight gray flash | `src/index.css` | ✅ | Global `* { -webkit-tap-highlight-color: transparent }`. |
| Overscroll behavior | `src/index.css` | ✅ | `overscroll-behavior: none` on `html, body`. Existing scroll containers retain their own behavior. |
| Touch action + callout | `src/index.css` | ✅ | `touch-action: manipulation` + `-webkit-touch-callout: none` on `button`, `a`, `[role="button"]`, `[role="tab"]`, `[role="menuitem"]`. Removes 300ms tap delay without disabling page-level zoom. `user-select: none` on buttons to prevent accidental selection. |
| Text-size-adjust + font smoothing | `src/index.css` | ✅ | `-webkit-text-size-adjust: 100%` (prevents iOS orientation reflow text bump), `-moz-osx-font-smoothing: grayscale`. |
| Tap target audit (≥44pt) | `ProfilePage.tsx` | ✅ | Audited bottom nav (≥44pt ✓), FAB (52px ✓), modal close buttons (≥44pt ✓). Fixed: mobile stripe buttons `w-10 h-10` → `w-11 h-11`. |
| iOS keyboard hints on auth inputs | `HomePage.tsx` | ✅ | Email got `type="email"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, `enterKeyHint`. Password got `autoComplete` switching `current-password`/`new-password` based on mode, `enterKeyHint="go"`. |
| iOS keyboard hints on reset password | `ResetPasswordPage.tsx` | ✅ | Both fields got `autoComplete="new-password"` + `enterKeyHint`. |
| iOS keyboard hints on profile | `ProfilePage.tsx` | ✅ | Name: `autoComplete="name"`, `autoCapitalize="words"`, `enterKeyHint="next"`. Gym (both autocomplete + manual): `autoCapitalize="words"`, `enterKeyHint="search"`/`"done"`. |
| iOS keyboard hints on search | `JournalIndexPage.tsx` | ✅ | Both search inputs: `type="search"`, `inputMode="search"`, `enterKeyHint="search"`, `autoCapitalize="none"`, `autoCorrect="off"`. |
| iOS system font stack | (no change) | — | Plus Jakarta Sans is an intentional brand decision, not a SF Pro fallback gap. Fallback chain already includes `-apple-system`. Decision noted; no change made. |

**Open question flagged but not changed:** `index.html` still has `maximum-scale=1.0` on viewport meta (a11y warning — blocks pinch-zoom). With `touch-action: manipulation` now in place globally, the original reason for it (300ms tap delay) is moot. Recommend dropping it for App Store accessibility review compliance — pending decision.

### Phase 2 — Capacitor shell setup (Mac required)

| Task | Component | Effort | Notes |
|---|---|---|---|
| Install Capacitor + iOS platform | Build config | Small | `npm i @capacitor/core @capacitor/cli @capacitor/ios` + `npx cap init` + `npx cap add ios`. Generates `ios/` Xcode project. |
| Apple Developer enrollment | Admin | — | $99/yr. Required for device install + TestFlight. Free Apple ID allows simulator-only. |
| First simulator build | Validation | Small | `npx cap run ios` → Xcode simulator. Confirm app loads, navigation works, no console errors. Document any breakage. |
| Live-reload dev workflow | Build config | Small | Configure Capacitor's `server.url` in dev to point at Vite's local server. Hot-reload in simulator while editing. |

### Phase 3 — Native plugins (Mac required for testing)

| Task | Component | Effort | Notes |
|---|---|---|---|
| Capacitor Haptics | `lib/haptics.ts` | Small | Wrap existing `navigator.vibrate` calls with `Capacitor.isNativePlatform()` branch; use `@capacitor/haptics` `Haptics.impact({ style: ImpactStyle.Light })` on native. Real iOS haptics are a different category of feel — Web Vibration is silently ignored on iOS Safari. |
| Status Bar | `App.tsx` init | Small | `@capacitor/status-bar` — set style (`Style.Dark`) + background color to match `PAGE_BG`. Removes default white bar above content. |
| Splash Screen | iOS config | Small | `@capacitor/splash-screen` — branded splash (copper background + wordmark or belt logo), auto-hide after first paint. Replaces Capacitor default. |
| Keyboard plugin | Form pages | Small | `@capacitor/keyboard` — listen for `keyboardWillShow`/`keyboardWillHide`, scroll active input into view, adjust `LogSessionForm` / `JournalEntryPage` layouts. |
| App Icon (1024px master) | Branding | Small | 1024×1024 source icon (copper + cream, BJJ-belt-evocative). Capacitor's icon generator produces all required sizes. |

### Phase 4 — TestFlight readiness (Mac required)

| Task | Component | Effort | Notes |
|---|---|---|---|
| App Store Connect record | Admin | Small | Create app entry, bundle ID, app name, category. Required before any TestFlight upload. |
| First archive + upload | Xcode | Small | Archive build, upload to App Store Connect via Xcode. First build typically requires fixing a handful of provisioning / entitlement issues. |
| Internal TestFlight invite | Admin | Tiny | Add self + any beta testers. Install via TestFlight app on iPhone. This is the **target milestone for May** — Journada running natively on a real device, not just simulator. |

### Out of scope (deferred to later sprint)

These are valuable but not required for "feels good on iPhone" — defer until after the May milestone:

- Drag-to-dismiss sheets (Vaul or similar) replacing current modal implementations
- Edge-swipe-back navigation wiring
- Pull-to-refresh on list pages
- GitHub Actions iOS build pipeline (cloud Mac runner — removes Mac dependency for daily builds)
- Spring physics audit against real iOS feel (`lib/spring.ts` tuning)
- Dark mode audit (app is already dark-themed by default; confirm `prefers-color-scheme` honored)
- Push notifications (Capacitor `@capacitor/push-notifications` + APNs setup)

### Why this sprint exists

iOS PWA on Safari is a second-class citizen regardless of how polished the web app gets — no real haptics, weak push, IndexedDB eviction risk, no App Store discovery. Capacitor closes that gap without forcing a React Native rewrite. The Phase 1 fixes alone make the PWA feel meaningfully better; Phases 2–4 unlock the native distribution path.

**Dependencies:** Mac access, Apple Developer account
**Unlocks:** TestFlight beta program, App Store submission, real device user testing, native iOS feature audits

---

## Sprint 8 — Move Library (Personal Video Vocabulary)

A personal library of techniques the user has invented or wants to remember, with optional video attachments. Each entry maps to a `user_tag` (the existing two-tier tag system) — every "move" is a tag, optionally enriched with a short video clip.

**Two-tier delivery strategy:**

### Tier 1 — Free (default, ship first)

Local-first storage. User records or uploads a video; the file lives in browser storage (OPFS or IndexedDB). The server only stores metadata + a small thumbnail.

| Component | Notes |
|---|---|
| Schema: extend `user_tags` | Add `has_video` BOOLEAN, `video_thumbnail` TEXT (data URL, ~10KB JPEG), `video_duration_seconds` INT, `video_notes` TEXT (description of the move). Migration 010. |
| Backend: extend userTagController | PATCH accepts the new video metadata fields. No file uploads — server never touches the actual video. |
| Frontend: `lib/videoStore.ts` | OPFS-first, IndexedDB fallback. CRUD for video blobs keyed by user_tag id. Quota-aware with friendly errors. |
| Frontend: `lib/videoUtils.ts` | Thumbnail extraction (canvas + first frame), duration probe, basic file validation (size cap ~50MB, duration cap ~60s). |
| Frontend: `MovesLibraryPage` | New page or section. Grid of tag cards with thumbnails. Tap to play. "+ Add video" button on tags without one. Recording via `<input type="file" accept="video/*" capture="environment">` for native camera. |
| Frontend: playback modal | Inline `<video>` element backed by `URL.createObjectURL(blob)`. Tap thumbnail anywhere in app (SessionDetailModal tag chips, TagPicker dropdown) to play. |
| Profile: storage usage indicator | Show "X of ~500MB used" with a meter. Browser-reported quota is ground truth. |

**Limits & known constraints:**
- iOS PWA storage quota varies (50MB → larger after install). Hard cap depends on device. Surface clearly when nearing limit.
- Video files don't survive a browser clear / reinstall — thumbnails on the server act as a "you used to have a clip for this" signal.
- No cross-device sync. Each device has its own library.

### Tier 2 — Cloud sync (paid, future)

Optional cloud backup so libraries survive device wipes and sync across devices.

| Component | Notes |
|---|---|
| Object storage: Cloudflare R2 | $0.015/GB/month, **free egress** (key advantage over S3). At 100MB avg library × 1000 users = ~$15/month. |
| Backend: signed upload URLs | `POST /api/user-tags/:id/video/upload-url` returns a 5-min signed PUT URL. Client uploads directly to R2. |
| Backend: signed playback URLs | `GET /api/user-tags/:id/video/url` returns a short-lived signed GET URL. |
| Backend: video metadata table | `tag_videos` table tracks cloud-stored variant — bytes, content-type, uploaded_at, expires_at (for trial/paid tier control). |
| Frontend: opt-in toggle per move | "Backup to cloud" switch on each tag's video editor. Default off. |
| Frontend: sync indicator | Cloud icon next to thumbnails for backed-up clips. Local-only clips show device icon. |

**Trigger to build Tier 2:** real user demand (e.g. "I lost my videos when I switched phones"). Don't build the infrastructure until there's a paying-user signal.

**Composability with existing systems:**
- Reuses `user_tags` (no new entity to learn)
- Reuses parent_pillar links (videos categorize the same way)
- Future analytics: "techniques I've documented vs trained" — a video without recent training is a candidate to revisit

---

## Sprint 9 — Home FAB Multi-Entry Composer

Restructures the mobile home page input flow. The current full-width "+ Mat time" button takes heavy real estate for a single action; the redesigned FAB becomes a multi-purpose entry point. Frees the home page to surface intent passively — in week cells and calendar entries that already carry data — rather than via a dominant CTA.

| Task | Component | Effort | Notes |
|---|---|---|---|
| Remove "+ Mat time" full-width button (mobile) | `HomePage` (mobile branch) | Small | Intent stays visible via existing `WeekIndicators` + `IntentionHeroCard`. Filled calendar cells already render their own entry surfaces; empty cells remain tappable for `LogSessionForm`. |
| FAB → action menu | `RepRouletteFab` (or new `HomeFab`) | Medium | Tapping FAB opens a small menu (radial or bottom sheet) with three options: Session, Journal, Technique. Existing Rep Roulette action needs a new home — long-press FAB, Profile surface, or deferred. |
| Session composer route | Existing `LogSessionForm` | Small | Wire FAB → Session action. Form already built; no new fields. |
| Journal composer | New `JournalEntryComposer` modal | Medium | Standalone journal entry not tied to an intention week. Fields: date, optional title, body, optional mood/tag. Data model: standalone `journal_entries` table OR extend `weekly_intentions.journal_entry` semantics — design decision pending. |
| Technique composer | New `TechniqueComposer` modal | Medium | Add a technique to the user's Move Library. Fields: name, parent pillar, optional video (Sprint 8 schema), optional notes. Reuses `user_tags` infrastructure. |
| Home page surface refresh | `HomePage` (mobile branch) | Small | Calendar/week cells become the primary "what happened / what's next" view. Cell tap → `SessionDetailModal` for filled, `LogSessionForm` for empty. |

**Design principle:** the home page should *show* intent, not *demand* it. The FAB is the universal "add" verb; what kind of thing is a secondary choice.

**Open questions to settle before scoping:**
- Rep Roulette action — move to long-press FAB, surface elsewhere, or defer?
- Journal entry data model — standalone entity or extension of the existing `weekly_intentions.journal_entry` field?
- Technique composer reuses Sprint 8's video pipeline — strict ordering applies (ship Sprint 8 first).

**Dependencies:** Sprint 8 (Move Library) for the technique composer's video schema.
**Unlocks:** unified composer surface that absorbs future entry types (recovery log, weight check-in, partner tag) as FAB menu items rather than dedicated buttons.

---

## Sprint 10 — Class Scheduling & Smart Push Notifications

**Goal:** capture sessions in the drive-home moment. Live testing confirmed users don't log right after class — they talk to teammates, leave the gym, and the round is freshest on the drive home. This sprint lets users define a recurring class schedule and emits three editorial notifications per class:

1. **Pre-class** (T-30 min) — surfaces active intention so they walk in carrying it.
2. **Post-class intention check-in** (T+0) — "How did the round feel?"
3. **Post-class log reminder** (T+8 min) — "A few quiet minutes — what stayed with you?"

**Brand register:** grace-framed, no exclamation points, no emoji. Refero anchors: Atoms habit-sentence (`665d…f4e1`), Headspace pre-permission categories (`8aa5…ddbf`), Atoms permission-with-preview (`d2e4…db3f`), Roots day presets (`53b0…5d85`), Andante list rows (`9115…65b9`).

| Task | Component | Effort | Status |
|---|---|---|---|
| Migration 019 — `users.timezone` (IANA) | backend | Small | ✅ |
| Migration 020 — `class_schedules` (per-day, per-user, soft-delete) | backend | Small | ✅ |
| Migration 021 — `push_subscriptions` (per-endpoint, per-category opt-in) | backend | Small | ✅ |
| Web Push setup — `web-push`, VAPID keypair, public-key endpoint | backend | Medium | ✅ |
| Notification scheduler — `node-cron` 1-min tick + `luxon` UTC↔IANA | backend | Medium | ✅ |
| `classScheduleController` + `pushSubscriptionController` + routes | backend | Medium | ✅ |
| Service worker — switch `vite-plugin-pwa` to `injectManifest`; `push` + `notificationclick` handlers in `src/sw.ts` | frontend | Medium | ✅ |
| Permission priming modal — three named categories + iOS-shape notification preview | frontend | Medium | ✅ |
| Class schedule editor — habit-sentence pattern with copper-underlined editable phrases | frontend | Medium | ✅ |
| Class schedule list — 2×n grid + copper-dashed Add tile (no FAB) | frontend | Small | ✅ |
| Notification settings sub-card — three category toggles + permission CTA | frontend | Small | ✅ |
| `pushClient.ts` subscription helper + iOS standalone-install detection | frontend | Small | ✅ |
| `timeUtils.ts` — IANA detect, time formatting, day-of-week helpers | frontend | Small | ✅ |
| ProfilePage entry card → `/profile/classes` | frontend | Tiny | ✅ |
| Docs: `database.md`, `api.md`, `Implementations.md`, `architecture.md` updates | docs | Small | ✅ |

**iOS gotcha:** PWA push only fires when the app is installed via "Add to Home Screen" on iOS 16.4+. The primer detects tab-mode (`navigator.standalone` / `display-mode: standalone`) and shows an install hint instead of silently failing. When the iOS Native Foundation (Sprint 7) ships Capacitor + APNs, the schedule + payload structure stays the same — only the delivery layer changes.

**Out of scope (deferred):**
- Rich inline-from-notification logging (slide/long-press to expand into a form on the lock screen). Requires a native Notification Content Extension — pick up when Capacitor lands.
- Geofence triggers ("you just left the gym").
- Calendar import (Google Calendar / iCal sync).

**Dependencies:** None blocking. PWA service worker existed; Web Push handlers added on top.
**Unlocks:** drive-home capture cadence, foundation for richer interaction once on native.

---

## Future — Personal Resonance via Technique Library

Builds on Sprint 8 (Move Library). Reframes session logging around three dimensions of experience: **class structure** (already covered: type, duration, gi/no-gi, intensity, source), **technical focus** (already covered: pillar chips, polarity, tags, canonical positions), and **personal resonance** — emotional / experiential context anchored *to specific techniques*, not to the session as a whole.

The session-log flow becomes a 2-tier chip cascade:

1. User selects a pillar chip (Stand-up / Passing / Pins / Subs / Guard) — existing flow.
2. Underneath the active pillar, the user can create or select **technique chips** within that pillar. Each chip is a first-class entry in a personal Technique Library (built on the `user_tags` + `canonical_positions` foundation Sprint 8 already lays down).

Each technique entry accumulates over time:
- A 30-second self-shot video of the user performing the technique (Sprint 8 schema)
- Technique notes — how to do it, key details (Sprint 8)
- **Experiential notes / resonance** — "how this technique feels for me," breakthroughs, emotional moments, sticking points (new — to be designed)
- Bidirectional session correlation: this technique points to every session it appeared in; every session lists the techniques drilled

**Why this matters:** the brand positioning is "lab notebook + memory book." The lab-notebook half is well-served by the existing structured fields. The memory-book half — the part that captures *meaning* — is currently a single freeform `notes` textarea on the session, which loses fidelity. Per-technique resonance gives the memory-book half a structure that accumulates value over years instead of dissolving into prose.

**Open design questions to settle before scoping:**
- Where does experiential resonance live — on the technique itself (single cumulative journal per move) or on the technique-session join (per-session entries that roll up on the technique page)? Per-session-rolling-up is the more flexible model.
- How many techniques per session? 1–2 primary or open-ended? Customer research suggests classes typically cover 3–5; capping at 1 is too tight.
- When does video capture happen — at session-log time (high friction, high fidelity) or at library-management time (low friction, may never happen)? Day One's pattern: video is *attachable* but rarely required at compose.

**Dependencies:** Sprint 8 (Move Library) — schema for video metadata on `user_tags` already shipped via migration 010. Migration 012 (canonical positions) provides the curated 60-move starter vocabulary.

**Unlocks:** per-technique analytics (frequency drilled, time since last drilled, resonance trends), technique-history view (a Pokedex-style page per move), eventual integration with the Atlas / search surfaces so a query like "every session where I drilled Bow and Arrow" becomes a visual journey across years.

**Status:** Documentation only — not scoped for implementation yet. Revisit after Sprint 8 ships.

---

## Sprint 11 — First-Time User Onboarding (Mobile-First PWA)

A new user signed up today and got dumped on `/home` with `FirstVisitCard` — Calendar, Atlas, Intentions, Journal, Library all silently rendered empty, the notification primer required manual discovery via Profile → Classes → Enable, and there was no name capture, no belt prompt, no concept of an onboarding-complete state.

This sprint ships a **6-screen mobile-first onboarding flow**, **4 contextual coachmarks**, and **3 editorial empty-state hero cards** so a new user reaches their first logged session in under a minute and discovers core features in their natural context — not via a tutorial walkthrough.

**Product framing:** Journada is "an app to help you track your jiu-jitsu — we'll build your training record over time." The Prism is *one* of the views, not the stated flagship. Onboarding copy reflects this throughout.

**Refero anchors:** Doji `f92a8b7a` (welcome splash), Endel `2d5f432f` (one-field-per-screen), Vocabulary `d06bc328` (belt-rank pills), Clearful `5f9d0b52` / ABY Journal `8416de7c` (empty-state hero), Alive `80e90b55` (first-action takeover), Planny `70bab285` (in-context permission prime), Moonly `31b1c0e2` (one-time coachmark spotlight).

| Task | Component | Effort | Status |
|---|---|---|---|
| Migration 022 — `users.onboarding_completed_at` (with backfill for pre-existing users) | backend | Small | ✅ |
| Backend `markOnboardingComplete` model + `POST /api/profile/onboarding-complete` | backend | Small | ✅ |
| Frontend `useOnboardingState` + `useCoachmark` hooks | frontend | Small | ✅ |
| `Coachmark` component (Moonly pattern — serif heading + copper glyph + Got-it pill) | frontend | Small | ✅ |
| `OnboardingShell` + `OnboardingProgress` (4-dot copper-fill bar) | frontend | Small | ✅ |
| `WelcomeSplashPage` — Cormorant wordmark + "A quiet place for your training." + copper Begin pill | frontend | Small | ✅ |
| `OnboardingNamePage` — single field, autofocus, copper underline | frontend | Small | ✅ |
| `OnboardingBeltPage` — 5 large pill rows + Skip link (skippable per user direction) | frontend | Small | ✅ |
| `OnboardingFirstSessionPage` — wraps `LogSessionForm` with editorial header + inline Prism coachmark | frontend | Medium | ✅ |
| `OnboardingDonePage` — "Your first session. Logged." takeover + conditional notification primer (only when standalone install) | frontend | Small | ✅ |
| Mobile-only `/` redirect → `/welcome`; desktop keeps existing `LandingPage` | frontend | Tiny | ✅ |
| `OnboardingGate` inside `ProtectedShell` — redirects half-onboarded users back into the flow | frontend | Small | ✅ |
| `LoginPage` — register success now redirects to `/onboarding/name` | frontend | Tiny | ✅ |
| Editorial empty-state heroes — Atlas / Journal / Library | frontend | Small | ✅ |
| Coachmark wiring — Calendar / Intentions / Class times (one-time per device, localStorage-persisted) | frontend | Small | ✅ |
| Docs — `roadmap.md` Sprint 11, `database.md` mig 022, `api.md` new endpoint, `Implementations.md` First-Time Onboarding section | docs | Small | ✅ |

**Onboarding flow shape (locked):**
1. `/welcome` (mobile only) → "Begin" → `/login?mode=register&from=welcome`
2. Email + password → register → auto-login → `/onboarding/name`
3. Name → `/onboarding/belt`
4. Belt rank (skippable) → `/onboarding/first-session`
5. Guided log: **"Log a session — you can add details later."** + inline Prism coachmark
6. `/onboarding/done` → conditional notification primer (only when PWA installed) → `markComplete()` → `/home`

**Coachmarks (one-time per device, contextual not orchestrated):**
- `coachmark.prism-log` — inline during onboarding step 5
- `coachmark.calendar` — first visit to `/calendar`
- `coachmark.intentions` — first visit to `/intentions`
- `coachmark.classes` — first visit to `/profile/classes`

**Out of scope (deferred — see Future / Backlog):**
- **Account-deferred sign-up** — let users log their first session before account creation. Revisit if onboarding drop-off > 25%.
- **Magic-link auth** — replace email + password with magic-link send. Revisit if password fatigue is reported.
- **Sprint 6 Adaptive Prism / focus-area picker** — onboarding ships with the existing 5 hardcoded BJJ pillars; focus-area picker stays in its own sprint.
- **Step-level drop-off telemetry** — needs a separate ticket so we have data before deciding on the deferred-account experiment.
- **A2HS install instruction screen** — defer until we measure how many users hit the "I want notifications but my PWA isn't installed" path.

**Dependencies:** None blocking. PWA service worker + notification primer were already shipped in Sprint 10.
**Unlocks:** lower drop-off cliff between sign-up and first value, foundation for the focus-area picker (Sprint 6) to slot in cleanly later.

---

## Future / Backlog

Lower priority or larger-scope items.

| Feature | Notes |
|---|---|
| iPhone widget — CompactHeatmap | `CompactHeatmap` is already widget-ready (3 props, no external state). Next step: explore React Native or Expo Widget API for home-screen export. |
| JWT refresh tokens | 24h expiry is current solution. Short-lived access token (15min) + refresh token stored in httpOnly cookie would be more secure. |
| OAuth (Google Sign-In) | Planned — requires Passport.js or similar strategy layer on the backend. |
| Belt promotion history | DB table not yet created. Track date promoted to each rank; display timeline on Profile page. |
| Social / sharing | Share a training milestone (e.g. streak, belt promotion) as an image. |
| Journada 2.0 — Journey Together | Long-horizon multi-user vision. Discover other practitioners, link training sessions across users ("we trained together that day"), let analytics graphs intermingle across linked partners. Far-out — may or may not be built — but documented so the data model and brand voice don't drift in directions that close the door on it. Implications worth keeping in mind even now: any data the user logs about partners (resonance entries, training-partner tags) should be designed so that, in a future world, it could be cross-referenced against another user's record without a structural rewrite. |
| Pagination (IntentionsPage / AnalyticsPage) | See Sprint 4 — All Time loads can be large for high-volume users. |
| Request logging middleware | No `morgan` or equivalent currently. Useful for debugging production issues on Railway. |
| GDPR: data export | Let users download all their data as CSV/JSON. |
| GDPR: account deletion | Delete user + cascade all sessions, intentions, profile. |
| Account-deferred sign-up | Let users log their first session before account creation. ABY Journal pattern. Revisit if onboarding drop-off > 25% after Sprint 11 ships. Backed by IndexedDB anonymous user → swap to real account on first save. |
| Magic-link auth | Replace email + password with magic-link send. Lower friction; adds an email-delivery dependency. Revisit after Sprint 11 ships if users complain about password fatigue. |
| Onboarding step-level drop-off telemetry | Add a `users.onboarding_step SMALLINT` column (0..4) so we can measure where users drop in the guided flow. Needed before deciding whether to invest in account-deferred sign-up. |

---

## Recently Completed

| Feature | Sprint | Notes |
|---|---|---|
| Admin dashboard + support cases | — | Migration 023: `users.is_admin BOOLEAN` + `support_cases` table (status / severity / subject / description + auto-context fields page_url / user_agent / app_version). Backend: `requireAdmin` middleware (chained after verifyToken on `/api/admin/*`), `supportCaseController.submitCase`, `adminController.getStats / getCases / patchCase / getUsers`. Frontend: `/admin` route gated by `useProfile().isAdmin` (Navigate-redirect to /home for non-admins), `AdminDashboardPage` with health strip + cases queue with status filter + recent users. `ReportProblemModal` reachable from the profile page (any authed user) — silently auto-attaches `window.location.href`, `navigator.userAgent`, and `VITE_APP_VERSION` so the user only types subject + description. ProfileContext extended with `isAdmin` field. Manual one-time `UPDATE users SET is_admin = true WHERE email = ...` to grant the founder admin. Done 2026-05-01. |
| iOS Native Foundation — Phase 1 (mechanical fixes) | 7 | `viewport-fit=cover` added to `index.html` (keystone fix — activated all existing `env(safe-area-inset-*)` calls that were silently no-ops). Global iOS-feel CSS in `src/index.css`: tap-highlight removal, `overscroll-behavior: none`, `touch-action: manipulation` on interactive roles (kills 300ms tap delay without disabling zoom), `-webkit-text-size-adjust: 100%`. `VideoPlayerModal` got safe-area padding (only modal missing it). Keyboard hints (`enterKeyHint`, `inputMode`, `autoComplete`, `autoCapitalize`, `autoCorrect`, `spellCheck`) added to `HomePage` auth, `ResetPasswordPage`, `ProfilePage`, `JournalIndexPage` search. `ProfilePage` mobile stripe buttons bumped 40→44px (iOS HIG min). Plus Jakarta Sans retained (brand decision). `maximum-scale=1.0` flagged for removal pending decision. Done 2026-04-25. |
| Rive belt scaffold removed | — | Deleted `RiveBeltBar.tsx`, `Docs/rive-belt-spec.md`, uninstalled `@rive-app/react-canvas`. AppShell + DesktopAppShell now import `BeltBar` directly. Decision: CSS BeltBar is good enough; carrying a 100KB+ dependency for an unbuilt asset was net-negative. Done 2026-04-25. |
| Dynamic Pillar Engine Phase 1 | — | 5 canonical pillars (standup → passing → pins → submissions → guard). Migration 005: renamed tags in-place + 4 new columns + resonance rename. Backend: heading/polarity/sub_skill_tag/script_source/resonance validated + stored. Frontend: LogSessionForm rewritten (heading selector, conditional polarity, source toggle, resonance dots). SKILL_TAGS reordered clockwise. `tags` auto-derived from `heading` for backward compat. |
| Week view toggle on Path Ahead | — | Carousel ↔ vertical session card list. localStorage persistence. |
| Compact heatmap view on Calendar | — | `CompactHeatmap` — GitHub-style, 18px cells, mobile scroll, auto-scroll to today, stats row. |
| Playwright mobile visual tests | — | E2E screenshots on Pixel 7 + iPhone 14 viewports. `visual-overview.spec.ts` test 08. |
| CSV bulk import | — | `CsvImportModal` + `POST /api/sessions/import`, max 500 rows, transactional. |
| PWA / offline support | — | Service worker, IndexedDB write queue, read cache, optimistic pending sessions. |
| Password reset via email | — | Resend SMTP, 1-hour token, `ResetPasswordPage`. |
| Home page redesign | — | Contextual greeting (HomeHeader), StatStrip (streak/sessions/hours), IntentionHeroCard, WeekIndicators (7 circles), FirstVisitCard (empty state), full-width CTA, conditional heatmap. |
| LogSessionForm 3-section layout | — | Visual hierarchy: The Basics → Your Focus (Prism centerpiece) → Details (optional). Full-width CTA. BeltDateBanner preserved. |
| Grappling Prism Phase 1 (IDW weights) | — | `calculateWeights()` with p=2 IDW, snap threshold (20% of R), live percentage labels, dual-mode hint text. Weights computed on frontend, not stored yet. |
| Prism-tap intention setting | — | SetIntentionModal rewritten with PillarPrism in `snapOnly` mode. Mid-week pivots (old intention shortened, new one starts today). Migration 007 adds `heading` to `weekly_intentions`. |
| Database hardening | — | Migration 006: indexes on `training_sessions(user_id, date)`, CHECK constraints on 9 enum columns. Auto-migration runner with `schema_migrations` tracking table. Connection pool configured (max 20, timeouts). |
| Refero research agent | — | Custom agent definition at `.claude/agents/refero-researcher.md` for UI/UX design research via Refero MCP. |
| App screenshots (2026-04-12) | — | 16 dated screenshots (8 pages x 2 viewports) stored in `Docs/screenshots/2026-04-12/`. |
| PillarPrism haptic feedback + visual polish | — | Haptic vibration on vertex snap (12ms), resonance tick (6ms), tap (8ms). Concentric guide rings (3 levels), directional gradient fill from active vertex, press-scale dot animation. New `lib/haptics.ts` utility. |
| Home page mobile/desktop split | — | `useIsDesktop()` hook (1024px breakpoint). Mobile: stacked modernized layout. Desktop: two-column grid (main + 340px sidebar) with "The Path Ahead" title. |
| LogSessionForm flagship redesign | — | 8 upgrades: unified `SegmentedToggle` (extracted as shared component), SURFACE_2 section cards, intensity color-gradient bar (5-segment, INTENSITY_COLOR palette), duration preset pills + styled stepper, 52px flagship submit button, contextual hints on Source/Polarity, sub-skill tag chip suggestions from recent sessions, removed fire emoji from StatStrip. |
| SessionDetailModal redesign | — | VIEW panel: SURFACE_2 section cards (Stats, Focus, Journal), intensity color bar (read-only), heading/sub_skill/resonance display. EDIT panel: SegmentedToggle (replaces native `<select>`), PillarPrism for heading, all Pillar Engine fields wired (heading, polarity, sub_skill_tag, script_source, resonance). |
| Intentions system modernization | — | IntentionsPage: SURFACE_2 cards with clear alignment indicators (colored bar + text), 2-col grid on desktop. SetIntentionModal: section cards, SegmentedToggle for duration, larger journal toggle, flagship button. JournalEntryPage: SURFACE_2 card, flagship Save button. |
| Spring physics system | — | `lib/spring.ts`: 4 presets (snappy/firm/heavy/gentle), `animateSpring()` rAF solver, `springToCss()` CSS approximation. Brand feel: heavy and deliberate, heavier than snappy, lighter than QuickBooks. |
| Desktop layout standardization | — | All pages use shared `useIsDesktop` hook. CalendarPage: max-w-7xl on desktop. AnalyticsPage: max-w-6xl. IntentionsPage: 2-col card grid. ProfilePage: max-w-2xl (up from max-w-xl). JournalEntryPage: max-w-3xl. |
| CalendarHeatmap (desktop) | — | New 52-week GitHub-style heatmap for Calendar desktop compact view. 16px cells, day labels (Mon/Wed/Fri), month labels, clickable cells (→ log session), hover scale, stats summary row (sessions, hours, streak, top focus). Replaces home page widget lift-and-shift. |
