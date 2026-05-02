# Feature List

A living document tracking implemented and planned features.

**Status key:** ✅ Done · ⚠️ Partial / known gap · 🔲 Planned

---

## Authentication

| Feature | Status | Notes |
|---|---|---|
| Email + password registration | ✅ | bcrypt 12 rounds, 409 on duplicate |
| JWT login (24h expiry) | ✅ | Token stored in localStorage |
| Auto-logout on 401 | ✅ | Via AuthContext error handler |
| Rate limiting on auth routes | ✅ | 10 req / 15 min per IP |
| Email case normalisation | ✅ | `.toLowerCase().trim()` applied before all DB lookups |
| Password reset (email token) | ⚠️ | Code complete; SMTP env vars missing locally (SMTP_HOST, SMTP_USER, FRONTEND_URL). Production Railway env needs same fix. |
| Server-side logout / token revocation | 🔲 | Client just discards token |
| OAuth (Google Sign-In) | 🔲 | Planned |
| JWT refresh tokens | 🔲 | 24h expiry is current solution |
| HomePage editorial design | ✅ | Backlit auth card (`CARD_GLOW` + `CARD_GLOW_BORDER`), copper "◇ For intentional grappling" micro-label, large Cormorant "Journada" wordmark with `j2-heading-glow`, italic subtitle "The mat remembers every session.", `SegmentedToggle` for Log In / Register, copper focus borders on inputs, 52px flagship CTA. `WaveBackground` dimmed via radial vignette so the card isn't fighting motion. Desktop wordmark 88px, mobile 72px (mobile maturity pass — was 56px). Mobile vignette `ellipse 380px 440px` with softer stops than desktop. |

---

## Session Logging

| Feature | Status | Notes |
|---|---|---|
| Log a session | ✅ | Date, duration, Gi/No-Gi, type, intensity, heading (pillar), notes |
| Edit a session | ✅ | PUT endpoint + SessionDetailModal inline editor |
| Multiple sessions per day | ✅ | No DB constraint; week view aggregates + navigator |
| Delete a session | ✅ | DELETE endpoint + inline confirm in SessionDetailModal |
| Bulk session import | ✅ | ImportModal supports .csv, .json, .numbers files — transactional batch insert, max 2,000 rows. Tags optional. Date format selector (Auto/MM-DD/DD-MM). Bulk tag setter + skip-all-untagged. Duplicate detection (409 + confirm). Dedicated Training Log parser for weekly-grid .numbers files. SheetJS lazy-loaded for .numbers support. |
| Grappling Prism gesture input | ✅ | PillarPrism: tap vertex for 100% heading OR drag into interior for IDW weight distribution. Dual-mode (snap threshold at 20% of R). Percentage labels shown in distribution mode. Weights persisted on every session as `pillar_distribution` JSONB (migration 009). |
| Prism vertex muting | ✅ | Short-tap directly on a vertex's dot toggles its muted state — excluded pillars drop out of IDW entirely (not zero-keyed). Visual feedback: dashed line ghosts to 0.08 opacity, label dims with `×` prefix, halo vanishes. iOS-native overshoot pump on toggle (`j2VertexToggle` keyframe, 320ms spring). Active heading can't be muted (rejected with 4ms haptic tick). One pillar must always remain active. |
| Prism snap-in affordance | ✅ | When the center dot crosses the snap threshold onto a vertex, an inner ring (r=9) and pumped vertex dot (r=5.5) appear with iOS-native spring overshoot (`j2VertexSnapIn` + `j2VertexDotPump` keyframes, 280ms / 240ms, `cubic-bezier(0.34, 1.56, 0.64, 1)`). Three stacked visual cues (halo + inner ring + larger dot) communicate "100% locked" without relying on haptics. |
| LogSessionForm 3-section layout | ✅ | Restructured into: The Basics (style/type/duration/intensity), Your Focus (Prism + polarity + source), Details (sub-skill/resonance/notes). Elevated "What did you work on?" section header with glow. Full-width CTA. |
| Dynamic Pillar Engine — Heading | ✅ | PillarPrism gesture replaces button selection. Snap mode = single heading. |
| Dynamic Pillar Engine — Polarity | ✅ | `offense` / `defense` / `neutral` — stored, only shown in form when heading is `guard` or `pins` |
| Dynamic Pillar Engine — Script Source | ✅ | `directed` / `organic` — session origin flag |
| Dynamic Pillar Engine — Sub-skill tag | ⚠️ | **Legacy** freeform text — replaced by two-tier user_tags (migration 008). Old field kept for backward compat reads. |
| Two-tier tag system (user_tags) | ✅ | Personal vocabulary linked to parent pillars. TagPicker autocompletes from user library, creates on-the-fly with current heading as parent. Multi-select up to 5. Migration 008. |
| Canonical position library | ✅ | Curated ~60 BJJ-position vocabulary (Closed Guard, De La Riva, Armbar, Triangle, etc.) seeded globally in migration 012 with alias arrays for typeahead. `TagPicker` searches both the canonical library and the user's private `user_tags` simultaneously, with case-insensitive substring matching against name + aliases. Typing "DLR" resolves to the canonical "De La Riva" before save — fixes the tag-drift problem where users wrote different spellings on different days. New user-typed positions still land in `user_tags` (private) and are eligible for curator promotion to the canonical library later. Sessions persist both via `user_tag_ids` and `canonical_position_ids` arrays. |
| Distribution-first persistence | ✅ | `pillar_distribution JSONB` on training_sessions. PillarPrism IDW weights persisted on every session. Server sanitizes (renormalizes to 1.0, drops invalid keys, drops zero-weights). Migration 009 inline-backfills legacy sessions from heading. Muted vertices arrive without their key — renormalisation runs across only the active set. |
| Per-pillar ACWR | ✅ | Acute-to-chronic workload ratio computed per pillar using proportional duration × intensity. Surfaces injury risk that the global ACWR misses (e.g. standup spike from competition prep). Wired into StatStrip "spike" view + AnalyticsPage insight sentence as Priority 0. |
| Move Library — Tier 1 (local) | ✅ | Personal video clips per `user_tag`. Files stored client-side in OPFS (preferred) / IndexedDB (fallback). Server stores only thumbnail + metadata (~10KB JPEG data URL + duration + notes). Capture via `<input type="file" capture="environment">`. Storage usage meter on Profile. Migration 010. |
| Move Library — Tier 2 (cloud sync) | 🔲 | Future paid tier — Cloudflare R2 ($0.015/GB/month, free egress). Signed upload URLs, opt-in per clip. Trigger to build: real user demand for cross-device backup. See roadmap Sprint 7. |
| Dynamic Pillar Engine — Resonance | ✅ | 1–10 haptic score stored as 2/4/6/8/10, displayed as 5 dots in form |
| Traction metric (Phase 2) | 🔲 | T = (Objective Alignment × 0.7) + (Subjective Resonance × 0.3) — deferred |
| Polarity drill-down on Prism node tap | 🔲 | Phase 2 — visualise offense/defense breakdown per pillar |
| Active Heading pulse on Prism | 🔲 | Phase 2 — highlight active heading vertex on Grappling Prism |
| Hit-Rate metric | 🔲 | Phase 2 — % of organic sessions where heading matched intention |
| Session date validation | ✅ | YYYY-MM-DD regex + `Date.parse()` check in controller |
| Duration/intensity range validation | ✅ | Controller validates ranges (1–720 min, 1–5 intensity) |

---

## Home Page (Path Ahead) — Redesigned

| Feature | Status | Notes |
|---|---|---|
| Contextual greeting (HomeHeader) | ✅ | "Good evening, [Name]" + formatted date. Uses ProfileContext `name` field. |
| Stat strip (StatStrip) | ✅ | Streak / sessions / hours — always visible, replaces hidden Telemetry tile |
| Intention hero card (IntentionHeroCard) | ✅ | Large card with heading vertex label, optional subtitle, particles, days remaining. Invitational empty state. |
| Week circle indicators (WeekIndicators) | ✅ | 7 circles (Mon-Sun) with intensity color fills. Today has copper border + pulse + "+" CTA. |
| First visit card (FirstVisitCard) | ✅ | Welcome message + "Log Your First Session" CTA. Shown when 0 sessions. |
| Full-width "+ Mat Time" CTA | ✅ | Brand-orange button below week indicators when today has no session |
| Rep Roulette (repositioned) | ✅ | Collapsible card with drill name teaser in collapsed state |
| Conditional heatmap | ✅ | Hidden until ≥5 sessions; placeholder text for new users |
| Week view toggle (carousel / list) | ✅ | Circle indicators (carousel mode) or vertical session card list. Persisted to localStorage. |
| Reflection card | ✅ | Rotating meditative prompt (1-of-6, stable per day via `Math.floor(today / 86400000)`). Italic Plus Jakarta Sans, copper "◇ Reflection" micro-label, button routes to journal entry or log session. |
| Reflection card height stability | ✅ | All 6 prompts pre-measured via Pretext (`@chenglou/pretext`) at the card's actual content width; the prose `<p>` is locked to the tallest height. Card no longer jumps between days as the prompt cycles. ResizeObserver re-measures on viewport / column changes. |
| Prestige aura — 26-week consistency | ✅ | When `consistentWeeks >= 26` (final 8th Gate), the StatStrip's "weekly" stat lights up in `PRESTIGE_TEAL` (#00D4AA) with a slow ethereal radial-gradient breathing aura behind it (`j2PrestigeBreathe` keyframe, 4.2s ease-in-out). On desktop the same treatment lands on the PathAhead "Consistent weeks" stat card with a teal border + inner glow. Reduced-motion override holds the aura at fixed opacity. The Eight Gates grid has been removed from the Profile page — this prestige state is the Easter-egg reveal for hitting the final gate. |

---

## Intentions

| Feature | Status | Notes |
|---|---|---|
| Prism-tap intention setting | ✅ | Tap a Prism vertex to declare focus. Label is optional flavor text. Replaces text+category form. Migration 007 adds `heading` to `weekly_intentions`. |
| Mid-week pivots | ✅ | Setting a new intention shortens the old one to end yesterday. Both appear in history. |
| View intentions history | ✅ | IntentionsPage with heading-based alignment dots |
| Delete intention | ✅ | From IntentionHeroCard with 2-step confirmation |
| Journal entry per intention | ✅ | Autosave 1.5s debounce |
| Journal inscribe reveal | ✅ | When an existing entry loads, prose appears line-by-line with Pretext-measured wrap points (so cadence reads as sentences, not characters). Each line uses `j2InscribeLine` keyframe (opacity 0→1 + 4px translate-up, 280ms `ease-luxury`) with staggered `animation-delay`. Stagger formula `min(150, max(40, 2400/lines))` caps total reveal at ~2.5s for long entries. Textarea is hidden + readonly during the reveal, then cross-fades to interactive over 240ms. Skipped for empty entries, reduced-motion users, and re-fetches (`textInitialized.current` guard preserved). Maps to "the mat remembers every session." |
| Intentions feature toggle (per user) | ✅ | Profile → Features, stored in DB |
| Edit intention (heading/label/duration) | ✅ | Prism shows current heading, label pre-filled |

---

## Calendar

| Feature | Status | Notes |
|---|---|---|
| Full-year heatmap | ✅ | TrainingHeatmap, intensity-coloured cells |
| Multiple sessions per day aggregated | ✅ | Sum duration, max intensity, all notes |
| Click day → SessionDetailModal | ✅ | Opens most intense session for that day |
| Intention periods shown on calendar | ✅ | Week-aligned overlay |
| Year navigation | ✅ | Backward / forward year selection |
| Compact view toggle | ✅ | CompactHeatmap — GitHub-style grid, 18px fixed cells, hidden-scrollbar horizontal scroll, auto-scrolls to today, stats row, legend. Persisted to localStorage. Widget-ready. |
| Mobile-optimised calendar view | ⚠️ | CompactHeatmap view is mobile-friendly (scrollable). Full TrainingHeatmap still requires horizontal scroll on phones. |

---

## Analytics

| Feature | Status | Notes |
|---|---|---|
| Grappling Prism (radar chart) | ✅ | 5 skill pillars, normalised. Time windows: 7D/2W/30D/3M/6M/1Y + custom range via `TimeRangeBar` |
| Prism draw animation | ✅ | Polygon expands from center on mount (elastic.out, 1.1s); radial gradient fill; warm copper undertone glow filter; grid rings pulse in with stagger; vertex dots pop in with back.out easing |
| Volume by Month (bar chart) | ✅ | Hours per month, current month highlighted. Bars grow upward on mount (elastic.out, 0.65s stagger) |
| Weekly chart (52-week bars) | ✅ | Bars grow from baseline with tight stagger |
| Gi vs No-Gi (donut) | ✅ | The Two Worlds view. Arcs draw clockwise via stroke-dasharray |
| Session Format (donut) | ✅ | Class / Drilling / Competition. Same draw animation as Gi/No-Gi donut |
| Intention vs Ambient Focus table | ✅ | Collapsible section, per-intention alignment history |
| View transitions (drum animation) | ✅ | Slide up/down, fade (desktop only) |
| Hours / percentage toggle | ✅ | Not available on Volume view |
| Mobile-optimised SkillRadar | ✅ | Separate flat layout on mobile — 210px chart, breakdown below, no drum/animation |
| Chart aesthetic alignment | ✅ | Grid/spoke color migrated from PALE_YELLOW → COPPER to match PillarPrism input. Warm copper glow filter. Spring-physics easing (elastic.out) matches app's "heavy, deliberate" personality per `lib/spring.ts` |
| Advanced analytics models | ✅ | `analyticsModels.ts` — entropy (diversity), ACWR (acute:chronic workload ratio), decay (rustiest pillar by days since last trained). Surfaced in home-page StatStrip cells |
| Session search | ✅ | `GET /api/sessions/search` with filters (date range, gi/nogi, heading, polarity, intensity, type, user_tag_id, text). Powers SessionSearchPanel on Calendar deep-dives |

---

## Profile

| Feature | Status | Notes |
|---|---|---|
| Name | ✅ | Free text, max 100 chars |
| Belt rank selector | ✅ | White → Black |
| Stripes (0–4) | ✅ | Only shown when belt rank set. Desktop: 5 segmented copper-bordered tiles (52px tall, glow on active). Mobile: original 4-button row preserved. |
| Home gym with Google Places autocomplete | ✅ | Degrades to plain text without API key |
| Intentions feature toggle | ✅ | Hides Intentions tab + disables editing |
| Desktop editorial layout | ✅ | `max-w-7xl` container with copper "◇ Your information" micro-label + 84px Cormorant "Profile" hero + italic subtitle. Two-column grid (form 7/12, sidebar 5/12 for Library / Import / Export). Form inputs use `SURFACE_3` background + copper focus borders matching the login page. 52px flagship CTA. Mobile layout unchanged. |
| Visible logout button | ✅ | Desktop: bordered red-400 pill, `padding: 14px 32px`, uppercase tracked label, hover brightens. Mobile: subtle text link preserved. Replaces the previously-hidden 30%-opacity ghost text. |
| Belt promotion history | 🔲 | Planned — DB table not yet created |

---

## Onboarding

| Feature | Status | Notes |
|---|---|---|
| Welcome screen | 🔲 | Brand intro + value prop, "Get Started" CTA |
| Name collection | 🔲 | Pre-fills `users.name` |
| Training goal selection | 🔲 | Single-select cards — 6 options (new `training_goal` column) |
| Experience level selection | 🔲 | Single-select cards — 4 tiers (new `experience_level` column) |
| Belt rank selection | 🔲 | Visual belt cards + stripes (existing columns) |
| Training frequency | 🔲 | Single-select — 3 options (new `training_frequency` column) |
| Focus areas (skill pillars) | 🔲 | Multi-select — 5 pillars (new `focus_areas` column) |
| Home gym | 🔲 | Google Places autocomplete (existing columns) |
| "Building your path" loading screen | 🔲 | Branded animation, auto-advance |
| Progress bar | 🔲 | 8-segment bar across all steps |
| Redirect logic (login → onboarding) | 🔲 | `onboarding_completed` flag on user |
| Personalised dashboard empty state | 🔲 | Uses goal + name from onboarding |
| DB migration `006_onboarding_fields` | 🔲 | 5 new columns on `users` |

---

## Navigation & Shell

| Feature | Status | Notes |
|---|---|---|
| Desktop top nav (5 tabs) | ✅ | `hidden sm:flex` |
| Mobile bottom nav (5 tabs) | ✅ | `sm:hidden fixed bottom-0` |
| Active tab indicator | ✅ | Underline (desktop), top bar (mobile) |
| Intentions tab gated on feature flag | ✅ | Hidden when disabled |
| Wave background in header | ✅ | Animated seigaiha pattern |
| Title bar shadow/backdrop | ✅ | Warm radial gradient behind "Journada" + BeltBar |
| BeltBar visibility (dark belts) | ✅ | Copper drop-shadow ensures black/brown belts visible on dark bg |
| BeltBar easter egg | ✅ | Tails follow mouse, whip on click |
| Belt-tying loading animation | ✅ | Looping belt-tie replaces grappling figures as app loader |
| iOS native-feel baseline | ✅ | `viewport-fit=cover` activates safe-area insets across the app. Global CSS: tap-highlight removal, `overscroll-behavior: none`, `touch-action: manipulation` (kills 300ms tap delay), `-webkit-text-size-adjust: 100%`. See `src/index.css` `@layer base`. |
| Safe-area insets (notch + home indicator) | ✅ | Applied via `env(safe-area-inset-*)` in AppShell header + bottom nav, all modals (CsvImportModal, SessionDetailModal, SetIntentionModal, VideoPlayerModal), CalendarPage, PathAheadPage, RepRouletteFab, TimeRangeBar. |
| iOS keyboard hints on form inputs | ✅ | `enterKeyHint`, `inputMode`, `autoComplete`, `autoCapitalize`, `autoCorrect`, `spellCheck` on auth (`HomePage`), password reset, profile name/gym, journal search. Email keyboard for email fields, search keyboard for search, "Go"/"Next"/"Done"/"Search" return-key labels. |
| Tap target ≥44pt audit | ✅ | iOS HIG minimum honored across bottom nav, FAB (52px), modal close buttons, profile stripe buttons (bumped 40→44px). |

---

## UI Design System

| Feature | Status | Notes |
|---|---|---|
| Unified `SegmentedToggle` component | ✅ | Shared across LogSessionForm, SessionDetailModal, SetIntentionModal. Copper active, SURFACE_2 track, haptic feedback. |
| SURFACE_2 section cards | ✅ | Consistent card containers in forms: "The Basics", "Your Focus", "Details". Rounded-xl, subtle border. |
| Intensity color-gradient bar | ✅ | 5-segment connected bar using INTENSITY_COLOR palette (sage → green → amber → orange). Labels: Light/Easy/Moderate/Hard/Max. Active segment expands. |
| Duration preset pills + stepper | ✅ | Quick-select (30m, 1h, 1.5h, 2h) + styled stepper with PALE_YELLOW display. |
| Flagship submit button | ✅ | 52px tall, brand orange, shadow, rounded-xl. Used in LogSessionForm, SessionDetailModal, SetIntentionModal, JournalEntryPage. |
| Contextual hints | ✅ | Helper text below Source ("Was this instructor-led or self-directed?") and Polarity controls. |
| Sub-skill tag chip suggestions | ✅ | Recent tags fetched from last 90 days of sessions, shown as tappable chips below input. |
| Haptic feedback (Vibration API) | ✅ | `lib/haptics.ts` — vertex snap (12ms), resonance tick (6ms), tap (8ms), toggle (8ms), intensity (10ms). Silent no-op on iOS/desktop. |
| Spring physics system | ✅ | `lib/spring.ts` — 4 presets (snappy/firm/heavy/gentle), rAF solver, CSS approximation. Brand feel: heavy and deliberate. |
| Mobile/desktop responsive layouts | ✅ | `useIsDesktop` hook (1024px). PathAheadPage: 2-col grid. CalendarPage: max-w-7xl + CalendarHeatmap. AnalyticsPage: max-w-6xl. IntentionsPage: 2-col card grid. ProfilePage: max-w-2xl. JournalEntryPage: max-w-3xl. |
| No emojis policy | ✅ | Fire emoji removed from StatStrip streak display. Brand relies on color, glow, and typography — no emojis anywhere. |

---

## Technical / Infrastructure

| Feature | Status | Notes |
|---|---|---|
| PostgreSQL on Supabase | ✅ | pg pool (max 20, 5s timeout), SSL |
| Auto-migration runner | ✅ | Numbered SQL files in `/migrations/`, tracked via `schema_migrations` table, auto-applied on startup |
| DB indexes (training_sessions) | ✅ | `idx_training_sessions_user_id`, `idx_training_sessions_user_date` — migration 006 |
| DB enum constraints | ✅ | CHECK constraints on gi_nogi, session_type, heading, polarity, etc. — migration 006 |
| JWT authentication | ✅ | 24h expiry |
| Zod validation on profile | ✅ | Other endpoints use manual validation |
| Rate limiting (auth only) | ✅ | Other endpoints unprotected |
| Tests | ⚠️ | Vitest suite exists (auth, sessions, JWT middleware) + Husky pre-commit hook; currently fails on run — fixture/mock setup incomplete. Frontend test files started (HomePage, LogSessionForm, PathAheadPage swipe). |
| Request logging | 🔲 | No middleware |
| Health check endpoint | ⚠️ | No dedicated `/health` route; `GET /` runs `SELECT 1` smoke test |
| Pagination | 🔲 | All records returned at once |
| CORS locked to origin | ✅ | `ALLOWED_ORIGIN` env var set in production |
| Email (password reset) via Resend | ✅ | Nodemailer SMTP relay, `smtp.resend.com` |
| Deployment on Railway | ✅ | Backend + frontend as separate Railway services |
| PWA manifest + icons | ✅ | `manifest.webmanifest` with 192/512/maskable icons, standalone display |
| Service worker (Workbox) | ✅ | vite-plugin-pwa, precache app shell, runtime cache Google Fonts + API GETs |
| Offline write queue | ✅ | IndexedDB-based queue in `offlineQueue.ts`, auto-replays on reconnect via `useOnlineSync` |
| Offline read cache | ✅ | `apiCache.ts` — IndexedDB cache of GET responses, 24h expiry. Transparent fallback in `api.ts`: serves cached data when offline. `useOnlineRefetch` hook triggers page refresh after reconnect. |
| Optimistic pending sessions | ✅ | `pendingSessions.ts` — sessions logged offline are stored in localStorage and merged into page displays immediately via `usePendingSessions` hook. Cleared automatically after sync. |
| Offline UI indicators | ✅ | `OfflineBanner` (amber/green bar), pending count, sync toasts, offline-aware LogSessionForm |
