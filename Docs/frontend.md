# Frontend Reference

Root: `project/J2/frontend_app/`

---

## Tech Stack

| Tool | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | Strict | Type safety |
| Vite | 5+ | Dev server + bundler |
| Tailwind CSS | 3 | Utility-first styling |
| React Router | 6 | Client-side routing |
| shadcn/ui | — | Select, Toast, Tooltip primitives |
| Radix UI | — | Underlying headless components |
| @googlemaps/js-api-loader | — | Google Places autocomplete in ProfilePage |
| vite-plugin-pwa | — | Service worker generation (Workbox) for PWA support |
| idb | — | IndexedDB wrapper for offline write queue |
| d3 | 7.9.0 | Data visualisation utilities — scales, path generators, transitions. See `Implementations.md` for usage pattern. |
| gsap | 3.14.2 | Animation library. Currently used in BeltDateBanner (Venetian blind unfurl). Available for future GSAP timeline migrations. |
| @chenglou/pretext | 0.0.6 (pinned) | Pure-JS multiline text measurement & layout that doesn't trigger DOM reflows. Wrapped by `lib/pretextMeasure.ts` for safe failure. Used by JournalEntryPage inscribe-reveal (line breaks) and PathAheadPage reflection card (height stability). Pre-1.0; pinned exactly. |

---

## Directory Structure

```
src/
├── app/
│   ├── HomePage.tsx            ← /  (login/register)
│   ├── DashboardPage.tsx       ← (legacy, not routed — see note)
│   ├── PathAheadPage.tsx       ← /home
│   ├── CalendarPage.tsx        ← /calendar
│   ├── AnalyticsPage.tsx       ← /analytics
│   ├── IntentionsPage.tsx      ← /intentions
│   ├── JournalEntryPage.tsx    ← /intentions/:id/journal
│   ├── ProfilePage.tsx         ← /profile
│   ├── MovesLibraryPage.tsx    ← /library
│   ├── ResetPasswordPage.tsx   ← /reset-password
│   └── __tests__/
│       ├── HomePage.test.tsx
│       └── PathAheadPage.swipe.test.tsx
├── components/
│   ├── AppShell.tsx
│   ├── BeltBar.tsx
│   ├── BeltDateBanner.tsx
│   ├── BeltLoader.tsx
│   ├── CompactHeatmap.tsx       ← widget-ready GitHub-style heatmap (CalendarPage compact view)
│   ├── CsvImportModal.tsx
│   ├── ErrorBoundary.tsx
│   ├── LoadingScreen.tsx
│   ├── LogSessionForm.tsx
│   ├── OfflineBanner.tsx        ← offline/reconnect indicator
│   ├── PageContent.tsx
│   ├── PageTransition.tsx
│   ├── SessionDetailModal.tsx
│   ├── SetIntentionModal.tsx
│   ├── SkillRadar.tsx
│   ├── TagPicker.tsx           ← dual-source autocomplete: canonical_positions + user_tags, with alias matching
│   ├── VideoPlayerModal.tsx    ← Move Library: blob-URL playback with object-URL lifecycle
│   ├── TimeRangeBar.tsx
│   ├── TrainingHeatmap.tsx
│   ├── WaveBackground.tsx
│   ├── __tests__/
│   │   └── LogSessionForm.test.tsx
│   └── ui/
│       ├── badge.tsx
│       ├── select.tsx
│       ├── toast.tsx
│       ├── toaster.tsx
│       └── tooltip.tsx
├── context/
│   ├── AuthContext.tsx
│   └── ProfileContext.tsx
├── hooks/
│   ├── useAuth.ts
│   ├── useCountUp.ts
│   ├── useOnlineRefetch.ts     ← re-calls fetch function after reconnect + sync
│   ├── useOnlineSync.ts        ← flushes offline queue on reconnect
│   ├── usePendingSessions.ts   ← returns pending offline sessions for optimistic display
│   ├── useUserTags.ts          ← user's personal tag library (CRUD + grouping by pillar)
│   ├── useCanonicalPositions.ts ← shared canonical BJJ-position library (read-only, module-cached)
│   └── use-toast.ts
└── lib/
    ├── api.ts
    ├── apiCache.ts              ← IndexedDB read cache for GET responses (offline fallback)
    ├── belt.ts
    ├── constants.ts
    ├── csvParser.ts             ← CSV import parser (PapaParse)
    ├── jsonParser.ts            ← JSON import parser
    ├── numbersParser.ts         ← Apple Numbers import parser (SheetJS, lazy-loaded)
    ├── trainingLogParser.ts     ← Dedicated parser for Training Log weekly-grid .numbers format
    ├── videoStore.ts            ← Move Library: OPFS-first / IndexedDB fallback blob storage + quota helpers
    ├── videoUtils.ts            ← Video file validation, thumbnail extraction (canvas), duration probe
    ├── offlineQueue.ts          ← IndexedDB offline write queue
    ├── pendingSessions.ts       ← localStorage store for sessions logged while offline
    ├── pretextMeasure.ts         ← thin façade over @chenglou/pretext for non-reflow text measurement (journal inscribe, reflection card height stability)
    ├── theme.ts
    └── utils.ts
```

---

## Pages

### `HomePage` — `/`
Login / register page shown to unauthenticated users. Editorial design: copper "◇ For intentional grappling" micro-label, Cormorant Garamond "Journada" wordmark with `j2-heading-glow`, italic subtitle "The mat remembers every session.", backlit auth card (`CARD_GLOW` + `CARD_GLOW_BORDER`), `SegmentedToggle` for Log In / Register, copper focus borders on inputs, 52px flagship CTA. `WaveBackground` dimmed via radial vignette so the card isn't fighting motion.
- **Viewport-tuned sizing:** wordmark 88px desktop / 72px mobile (mobile maturity pass), card padding 36px / 28px, card max-width 460 / 400, subtitle 18 / 16.5px.
- **Wave + vignette:** wrapper opacity 0.6 desktop / 0.8 mobile. Vignette `ellipse 520×620` desktop / `380×440` mobile (smaller ellipse + softer stops on mobile so corners stay lively).
- Tabs: Login / Register / Forgot
- Fields: email, password
- API: `POST /auth/login`, `POST /auth/register`, `POST /auth/request-password-reset`
- On success: stores JWT, redirects to `/home`

### `PathAheadPage` — `/home`
Main dashboard. Layout diverges by viewport:

**Mobile (`<1024px`):** Single-column stacked layout composed of redesigned sub-components — `HomeHeader` (greeting + date), `StatStrip`, `IntentionHeroCard`, `WeekIndicators` (7 day circles), full-width "+ Mat Time" CTA, Rep Roulette collapsible, and conditional `HeatmapPreviewWidget`. `FirstVisitCard` replaces everything below the stat strip when the user has 0 sessions.

**Desktop (`≥1024px`):** Two-column grid (`1fr:340px`, 28px gap) inside `max-w-6xl`. Title `"The Path Ahead"` + formatted date + name appear above the grid. LEFT column: week section (view-toggle with Circle / List modes), telemetry expanded panel, Rep Roulette. RIGHT column: `StatStrip`, `IntentionHeroCard`, heatmap widget.

**Shared state:**
- `windowDays`: 11-day `Date` array (today − 5 through today + 5) for the list view
- `sessionsByDate`: `Map<string, SessionSummary[]>`
- `activeIntention`: intention whose date range contains today
- `weekView` persisted to `localStorage` (`j2_week_view`)

**Reflection card:** Rotating meditative prompt (1-of-6, stable per day via `Math.floor(today / 86400000) % 6`). All 6 prompts pre-measured at the card's actual content width via `pretextMeasure.maxLinesHeight` and the prose `<p>` is locked to the tallest height — card stops jumping height as the prompt cycles day-to-day. ResizeObserver re-measures on viewport / column changes. `REFLECTION_PROMPTS` is a module-scope `as const` so the measurement memo doesn't invalidate every render.

**Modals:** LogSessionForm (full-screen with `rgba(13, 26, 20, 1)` opaque backdrop + `blur(16px)` — bumped from 0.97 to kill wave-pattern leak), SetIntentionModal, SessionDetailModal.

**API:** `GET /api/sessions?from=&to=`, `GET /api/intentions/current`, `GET /api/intentions`, `POST/DELETE /api/intentions/:id`, `DELETE /api/sessions/:id`.

### `CalendarPage` — `/calendar`
Full-year training heatmap with two views.
- **View toggle** — `calView` state (`'compact' | 'detailed'`), persisted to `localStorage` (`j2_cal_view`). Segmented pill (LayoutGrid / CalendarDays icons) in the header between the title and year nav.
  - `'compact'` → renders `CompactHeatmap` (GitHub-style, mobile-scrollable, widget-ready)
  - `'detailed'` → renders `TrainingHeatmap` (full interactive grid with modals and intention overlays)
- Year selector (backward / forward navigation) works identically for both views; year-flip animation applied to whichever view is active
- Sessions fetched scoped to the selected year: `GET /api/sessions?from=YYYY-01-01&to=YYYY-12-31`; re-fetches when year changes
- API: `GET /api/sessions?from&to`, `GET /api/intentions`

### `AnalyticsPage` — `/analytics`
Skill and training analytics.
- `SkillRadar` with 4 views (Grappling Prism, Volume, Two Worlds, Format)
- `timeWindow` state (`'30d' | '60d' | '90d' | 'all'`, default `'90d'`) is lifted here and passed to SkillRadar; sessions are re-fetched scoped to the active window
- Collapsible "Intention vs Training Telemetry" table — one row per intention, showing stated goal vs most-trained skill tag during that period (scoped to active window)
- API: `GET /api/sessions?from=` (scoped by window; no params when "All Time"), `GET /api/intentions`

### `IntentionsPage` — `/intentions`
History of all weekly intentions.
- 4-column table: Week / Intention / Ambient Focus / Journal
- Ambient Focus computed from sessions during each intention's date range
- Journal column links to `JournalEntryPage`
- API: `GET /api/intentions`, `GET /api/sessions`

### `JournalEntryPage` — `/intentions/:id/journal`
Per-intention journal editor.
- Autosaves 1.5s after user stops typing
- Read-only when `intentionsEnabled` is false
- **Inscribe reveal on initial load:** if the intention has a saved `journal_entry`, the prose appears line-by-line over ~1.5–2.5s before the textarea becomes interactive. Lines respect actual word-wrap break points (measured via `pretextMeasure.measureLines`), so cadence reads as sentences. Each line uses the `j2InscribeLine` keyframe (opacity 0→1 + 4px translate-up, 280ms ease-luxury) with stagger `min(150, max(40, 2400/lines))` ms. Textarea is hidden + readonly during reveal, then cross-fades to interactive over 240ms. Skipped for empty entries, reduced-motion users, fetch errors, and re-fetches (`textInitialized.current` guard).
- API: `GET /api/intentions` (to find the specific intention), `PATCH /api/intentions/:id/journal`

### `ProfilePage` — `/profile`
User profile settings. Mobile keeps the original single-column form. Desktop is a full editorial redesign.

**Mobile:** Single-column form with name, belt rank, stripes, home gym, features toggle, save button, sidebar cards (Move Library, Import, Export), and ghost-text logout.

**Desktop (`≥1024px`):** `max-w-7xl px-10 py-12` container. Header is a copper "◇ Your information" micro-label + 84px Cormorant "Profile" hero with `j2-heading-glow` + 20px italic subtitle. Two-column grid (`grid-cols-12 gap-8`): form spans cols 1–7, sidebar (Move Library / Import / Export) spans cols 8–12. Form inputs use `SURFACE_3` background + 1px ghost border + copper focus border (matching the login page). Stripes render as 5 segmented copper-bordered tiles (52px tall, glow on active). Save is the 52px flagship CTA. Logout is a bordered red-400 pill, uppercase tracked label, hover brightens — replaces the previously-hidden 30%-opacity ghost text.

- Name, belt rank, stripes (0–4)
- Home gym: Google Places autocomplete if `VITE_GOOGLE_MAPS_API_KEY` set, otherwise plain text
- Intentions feature toggle
- Move Library entry point with browser storage usage meter (shows usage % and warns at >80%)
- Import / Export sections
- API: `GET /api/profile`, `PUT /api/profile`, `navigator.storage.estimate()` for the meter

### `MovesLibraryPage` — `/library`
Personal video library of techniques (Move Library, Sprint 7 Tier 1).
- Grid of `user_tag` cards with thumbnails when video is attached
- Filter pills: All / With video / Needs video
- Tap card with video → `VideoPlayerModal` plays from local storage
- Per card: "+ Record / Upload" (file picker with `capture="environment"` for native camera) and "Replace" / "Remove" actions
- Per-pillar count legend at the bottom
- Pipeline (in `useUserTags.attachVideo()`): validate file → probe duration → check quota → extract thumbnail (canvas) → save blob locally → PATCH metadata to server
- Local storage layer: `videoStore.ts` (OPFS-first, IndexedDB fallback)
- API: `GET /api/user-tags`, `PATCH /api/user-tags/:id/video`

### `DashboardPage` — (legacy, not routed)
Full-featured standalone dashboard page (TrainingHeatmap + SkillRadar + BeltBar + LogSessionForm modal) that predates the current multi-page architecture. The file exists but is **not imported or rendered** by `App.tsx`. The `/dashboard` URL is handled directly in the router with `<Navigate to="/home" replace />`. Safe to delete if desired.

### `ResetPasswordPage` — `/reset-password`
Password reset form. Not wrapped in `ProtectedShell` — accessible without a token.
- Reads `?token=...` from query string; shows inline error message and disables the submit button if token is absent
- Fields: new password (min 8 chars) + confirm password — validated client-side before the API call
- API: `POST /auth/reset-password`
- On success: transitions to an inline success state with a "Go to Log In" button that navigates to `/`

---

## Components

### `AppShell`
Wraps all authenticated pages. Renders:
- Header: `WaveBackground` + title shadow + "Journada" + `BeltBar`
- `OfflineBanner` — between header and main content
- Desktop nav: `hidden sm:flex` — 5 tabs (Home, Calendar, Analytics, Intentions, Profile)
- Mobile nav: `sm:hidden fixed bottom-0` — 5 tabs with icons and labels
- Intentions tab gated on `useProfile().intentionsEnabled`
- Calls `useOnlineSync()` — flushes offline queue on reconnect
- Note: Logout button lives in `ProfilePage`, not in the shell header

### `BeltBar`
Animated tied-belt display in the header. Imports shared types/constants from `lib/belt.ts`.
- On mount: belt slides in (500ms), knot forms (300ms), tails drop with pendulum overshoot (480ms), golden sparks fire
- Interactive: tails follow mouse on hover, whip on click (easter egg)
- Visibility: copper `drop-shadow` filter ensures dark belts (black, brown) remain visible against the dark page background
- Props: `rank?: string | null`, `stripes?: number`
- Re-exports: `BeltRank`, `BELT_COLORS`, `PATCH_COLORS` from `lib/belt.ts`

### `WaveBackground`
Animated seigaiha (Japanese wave tile) pattern used in headers.
- 36×36px half-drop staggered tiles, 14s drift loop
- Copper/clay strokes on dark background

### `LogSessionForm`
Form to log a new training session. Rewritten for the Dynamic Pillar Engine.
- Fields: date (via `BeltDateBanner`), Gi/No-Gi toggle, session type, duration stepper (30-min increments, 30–240 min), intensity 1–5, **Heading** (single-select pillar button), **Polarity** (offense/defense/neutral — only shown when heading is `guard` or `pins`), **Script Source** (directed/organic toggle), **Sub-skill tag** (free text), **Resonance** (5-dot haptic picker — dots map to 2/4/6/8/10), notes
- Fetches current week intention via `GET /api/intentions/current?week_start=...` on mount; shows as a hint below the Heading selector
- Validates: duration > 0, heading required (replaced multi-tag requirement)
- Submit payload includes all new Dynamic Pillar fields; `tags: [heading]` sent for backward compatibility with SkillRadar/Prism consumers
- **Offline support:** recognises `_offline` flag in API response, shows "Session saved offline — will sync when connected" toast, and saves a pending `SessionSummary` (with temp `pending-*` ID) to `pendingSessions.ts` so the session appears in the UI immediately
- Props: `onSuccess?: (sessionCount?: number) => void`, `onCancel?: () => void`, `defaultDate?: string`

### `OfflineBanner`
Thin status bar shown between the header and main content when the app is offline.
- Shows amber "You're offline — sessions will be saved locally" with pending queue count
- Flashes green "Back online" for 2.5s when connectivity returns
- Polls `offlineQueue.count()` every 3s while visible
- No props

### `SessionDetailModal`
Full-screen modal showing session details with optional edit mode.
- Displays: session navigator (`← session N of M →`), intention banner, 2×2 stat tiles (Style / Type / Intensity / Duration), skills, journal notes
- Edit mode: inline editing of all fields
- Navigation props for multi-session days: `sessionCount`, `sessionIndex`, `onNavigate`
- Delete: "Delete session" text button (view mode only) → inline confirm row → calls `DELETE /api/sessions/:id` → `onDeleted?.()` + closes modal
- `key={session.id}` in parent ensures full re-mount on session switch (resets edit state)
- Props: `session`, `date`, `intention?`, `sessionCount?`, `sessionIndex?`, `onNavigate?`, `onClose`, `onSaved`, `onDeleted?`

### `SetIntentionModal`
Small modal to create a weekly intention.
- Fields: label (max 20 chars), category (5 options), duration (3/5/7/14 days), optional journal toggle
- Props: `weekStart: Date`, `onSaved: () => void`, `onClose: () => void`

### `SkillRadar`
Analytics component with 4 interchangeable views. Uses separate rendering paths for mobile and desktop.
- **Grappling Prism**: Pentagon radar of 5 skill pillars (Stand-up, Guard Passing, Dynamic Pins, Submissions, Guard) in clockwise adjacency, normalised to max hours in window
- **Volume by Month**: Bar chart of hours per month, current month highlighted
- **The Two Worlds**: Gi vs No-Gi donut chart
- **Session Format**: Class / Drilling / Competition donut chart
- Time window buttons: 30d / 60d / 90d / All Time — controlled externally via props (window state lifted to AnalyticsPage)
- Display mode toggle: hours / percentage (not available on Volume view)
- **Mobile** (`sm:hidden`): flat `flex-col` layout — chart at fixed 210px width, breakdown rows below, no animation. View switcher is a horizontal icon row above the chart.
- **Desktop** (`hidden sm:flex`): animated drum with `absolute inset-0` panels, slide up/down/fade transitions, vertical icon rail on the right.
- Internal helpers: `renderChart(mode)`, `renderBreakdownContent(mode)`, `renderContent(mode, animClass, onAnimEnd)` (desktop only)
- Props: `sessions: SessionSummary[]`, `timeWindow: TimeWindow`, `onWindowChange: (w: TimeWindow) => void`
- Exports: `TimeWindow` type (`'30d' | '60d' | '90d' | 'all'`)

### `TrainingHeatmap`
Full-year calendar grid.
- One row per week (Mon–Sun), sticky day-name header
- Cell colour by max intensity in day: Rest (#0d1a26) / Easy (#CDDFA0) / Moderate (#6FD08C) / High (#DA7422)
- Aggregates multiple sessions per day: sums duration, takes max intensity, collects all notes
- Click any day to open SessionDetailModal (shows most intense session)
- Skeleton shimmer loading state
- Right columns: intention label + journal link per week
- Props: `sessions?`, `intentions?`, `loading?`, `onSessionUpdated?`, `beltRank?`, `stripes?`, `year?`
- **Shared utility exports** (used by `CompactHeatmap`): `localDateKey`, `toDateKey`, `DayData`, `EMPTY_DAY`, `cellColor`, `buildDayMap`, `computeStats`

### `CompactHeatmap`
Widget-ready GitHub contribution-graph style heatmap. Purely visual — no modals, tooltips, or click handlers.
- Props: `sessions: SessionSummary[]`, `year: number`, `loading?: boolean`
- **Stats row**: 4 animated metric boxes (Sessions, Hours, Gi%, Streak) with `useCountUp` count-up animations
- **Scrollable grid**: month labels + 7-row × N-column heatmap wrapped in a hidden-scrollbar `overflow-x: auto` container. Auto-scrolls to today's column on mount. Cells are 18px × 18px (fixed size, not fluid) so they're clearly visible on mobile — the grid overflows and scrolls.
- **Today**: copper outline on today's cell; future days shown in `#10241A`; out-of-year cells near-transparent
- **Legend**: Rest / Easy / Moderate / High colour swatches at bottom
- **Skeleton loader**: pulsing placeholder shown when `loading=true`
- **Utilities**: imports `buildDayMap`, `cellColor`, `computeStats`, `localDateKey`, `DayData`, `EMPTY_DAY` from `TrainingHeatmap.tsx`
- **Widget-ready**: self-contained (3 props only), no external state dependencies, designed for future iPhone widget extraction

### `CsvImportModal`
Full-screen modal for bulk session import from `.csv`, `.json`, or `.numbers` files.
- Accepts three file formats: CSV (PapaParse), JSON (native), Apple Numbers (SheetJS, lazy-loaded)
- Auto-detects the "Training Log" weekly-grid `.numbers` format and routes to dedicated parser (`trainingLogParser.ts`)
- Date format selector: Auto-detect / MM/DD / DD/MM
- Tags column support — parses semicolon-separated tags from CSV
- Tags are optional — sessions can be imported without tags
- Bulk actions: "Set all missing durations to 60 min", "Set all missing tags to...", "Skip all untagged"
- Duplicate date detection: backend returns 409, modal shows "Import anyway" confirmation
- Displays row-by-row review table before committing
- Submits valid rows to `POST /api/sessions/import` (max 2,000 rows)
- Duration heuristic: bare numbers >12 treated as minutes, ≤12 as hours
- Props: `existingDates: Set<string>`, `onClose: () => void`, `onImported: () => void`

### `BeltDateBanner`
Full-bleed date selector rendered at the top of `LogSessionForm`. Replaces a plain date input with an animated belt-fabric reveal. Uses the `gsap` animation library.
- GSAP timeline: belt body sweeps left→right (`expo.out`, 0.52s), patch continues from the junction (0.20s), date text fades in — reads as one continuous piece of fabric being laid down
- Belt color and stripe count derived from `useProfile()` (matches the user's current rank)
- A transparent `<input type="date">` overlays the entire banner to capture taps and open the native picker
- Props: `value: string` (YYYY-MM-DD), `onChange: (date: string) => void`, `required?: boolean`

### `BeltLoader`
Looping belt-tying animation used as the app's loading indicator. Imports shared types/constants from `lib/belt.ts`.
- Plays the full tying sequence (slide in → knot → tails drop → sparks → hold → fade out) on repeat
- Default colour: copper/gold (`#C4915F`) when no rank is provided — matches the app's accent palette
- Scaled ~3.5× larger than the header BeltBar for loading screen prominence
- Keyframes namespaced with `j2Ldr` prefix to avoid collision with header BeltBar
- Props: `rank?: BeltRank | null`, `stripes?: number`

### `LoadingScreen`
Full-page loading indicator wrapper.
- Renders `BeltLoader` centred with "Loading" text below
- Used by: AnalyticsPage, IntentionsPage, PathAheadPage, ProfilePage, JournalEntryPage
- No props

### `ErrorBoundary`
Class component that catches render-phase errors.
- Props: `children`, `fallback?: ReactNode`

### `SegmentedToggle`
Shared toggle button group used across LogSessionForm, SessionDetailModal, and SetIntentionModal. Unified visual language for all 2-way and 3-way selections.
- Props: `options: {value, label}[]`, `value: T | null`, `onChange`, `deselectable?: boolean`
- Style: `SURFACE_2` track, `COPPER` active fill, `rounded-[10px]` segments, haptic feedback on tap
- Replaces all old inconsistent toggle patterns (rounded-full brand-orange, rounded-lg copper, native `<select>`)

### `CalendarHeatmap`
52-week GitHub-style heatmap for the Calendar page desktop compact view. Purpose-built replacement for the home page HeatmapPreviewWidget.
- Props: `sessions: SessionSummary[]`, `year: number`, `onLogSession?: (dateKey: string) => void`
- 16px cells, 3px gaps, day labels (Mon/Wed/Fri), month labels at boundaries
- Clickable cells → open log session form. Hover scale 1.3x. Today copper outline.
- Stats summary row below: sessions, hours, streak, top focus pillar
- Auto-scrolls to right edge (today) on mount

### `HomeHeader`
Contextual greeting at the top of PathAheadPage (mobile). Time-aware: "Good morning / afternoon / evening, [Name]" + formatted date.
- Props: `name: string | null`
- Font: `font-display` (DM Serif Display), `PALE_YELLOW` + `GLOW_SOFT`

### `StatStrip`
Three-cell horizontal strip on the home page: streak / weekly sessions / weekly hours. Always visible — replaces the hidden Telemetry tile pattern. Cell taps open the telemetry expanded panel.
- Props: `streak`, `longestStreak`, `weekSessionCount`, `weekTotalMinutes`, `onTap?`, plus optional `acwr?: ACWRResult`, `decay?: DecayResult[]`, `consistentWeeks?: number`
- Tappable left cell cycles through views: streak → weekly gates (8 levels from `EIGHT_GATES`) → sessions
- 26-week consistency unlocks `generateBurstParticles()` burst animation **plus the prestige aura**: weekly value flips to `PRESTIGE_TEAL` (#00D4AA), gets a `0 0 14px 3px PRESTIGE_TEAL_GLOW` cell glow, and a slow ethereal radial-gradient breathing aura renders behind the number (`j2PrestigeBreathe` keyframe, 4.2s ease-in-out, screen blend-mode). Same teal treatment lands on the desktop PathAhead "Consistent weeks" stat card. Reduced-motion override holds the aura at fixed opacity.
- Background uses `CARD_GLOW` + `CARD_GLOW_BORDER` (backlit glow instead of copper border)

### `IntentionHeroCard`
Large hero card on the home page showing the active weekly intention with heading vertex label, optional subtitle, particles, days remaining, weekly session progress bar. Invitational dashed-border empty state when no intention set.
- Props: `intention: Intention | null`, `weekSessionCount?`, `onSetIntent`, `onEditIntent?`, `onViewJournal?`, `onDeleteIntent`
- 2-step delete confirmation with 3s timeout auto-dismiss

### `WeekIndicators`
Seven circle indicators (Mon–Sun) on the home page. Intensity-color filled for trained days, dimmed for rest, copper border + pulse + "+" CTA for today when empty.
- Props: `weekDays: Date[]`, `today: Date`, `sessionsByDate: Map<string, SessionSummary[]>`, `onDayTap`, `onLogTap`

### `FirstVisitCard`
Welcome card shown on the home page when `allSessions.length === 0`. Replaces a page full of zeros and "Rest" labels with a single inviting CTA.
- Props: `onLogFirst: () => void`
- Uses `CARD_BG`, `COPPER_BORDER`, `CARD_SHADOW`, full-width brand-orange button

### `PillarPrism`
Gesture-based pentagon input for session heading + IDW pillar distribution. Tap a vertex → 100% that pillar. Drag into interior → IDW weights across all (active) pillars with live percentage labels. Dual-mode via 20%-of-R snap threshold.
- Props: `heading: string | null`, `resonance: number | null`, `onSelect: (h, r, weights) => void`, `defaultHeading?`, `snapOnly?: boolean` (intention setting forces single-vertex)
- viewBox `0 -16 240 246` with `overflow: visible` so the top "Stand-up" label clears the SVG bounds and the modal title above
- **Vertex muting** — short-tap directly on a vertex's dot (within `VERTEX_TAP_RADIUS = 14` SVG-coord px) toggles its muted state. Tap-vs-drag disambiguation: pointerdown on a vertex defers placement; if pointerup arrives within 400ms with movement < 4px, it's a tap (toggle); otherwise commits to drag. Active heading and the last remaining active vertex can't be muted (rejected with 4ms haptic tick). Muted pillars are absent from the IDW dict entirely (not zero-keyed) so the backend renormalises across only the active set.
- **Always-visible vertex dots** — every vertex renders a tappable copper dot (r=4 inactive, r=5 primary, r=5.5 snapped). Muted vertices render a smaller dashed-hollow dot to keep the tap affordance visible.
- **Snap-in inner ring** — when `isSnapped && primary`, an additional r=9 copper ring appears around the vertex, alongside the existing pulsing halo and enlarged dot. Three stacked cues for "100% locked" without relying on haptics.
- **Animation polish** — `j2VertexToggle` (320ms scale-up overshoot pump on toggle), `j2VertexSnapIn` (280ms inner-ring scale-from-1.4 settle), `j2VertexDotPump` (240ms vertex-dot pump) all using `cubic-bezier(0.34, 1.56, 0.64, 1)` for iOS-native spring feel. React `key` changes on `lastToggle.instance` and `snapInstance` force remounts to retrigger the keyframes. All three respect `prefers-reduced-motion`.
- Haptic feedback: vertex snap 12ms, resonance tick 6ms, pointer-down 8ms, **mute toggle 60ms** (categorically distinct from the 6/8/12ms ticks), reject-tick 4ms.
- Used by: LogSessionForm, SessionDetailModal, SetIntentionModal

### `VideoPlayerModal`
Plays a Move Library clip from local storage. Loads the blob via `videoStore.loadVideo(tag.id)`, creates an object URL, hands it to `<video controls autoPlay playsInline>`, and revokes the URL on unmount to prevent leaks. Falls back to a "video unavailable on this device" message (with the server-side thumbnail dimmed underneath) when the local clip is missing — covers the cross-device case where metadata synced but the file lives on another browser.
- Props: `tag: UserTag`, `onClose: () => void`
- Renders into `document.body` via `createPortal`

### `TagPicker`
Multi-select autocomplete searching across **two libraries simultaneously**: the curated `canonical_positions` (~60 BJJ positions seeded in migration 012, e.g. "De La Riva", "Armbar") and the user's private `user_tags`. Substring + alias matching, case-insensitive — typing "DLR" surfaces "De La Riva" via its alias. Canonical results rank first; user customs render with a small "yours" badge in the dropdown. Existing chips render uniformly (copper pills) regardless of source. Max 5 selected total.
- Props: `selectedUserTagIds: string[]`, `selectedCanonicalIds: string[]`, `onChange: (userTagIds, canonicalIds) => void` (dual arrays), `currentPillar: Pillar | null` (used as parent for new user tags), `maxSelected?: number` (default 5)
- Internally uses `useUserTags()` (CRUD) and `useCanonicalPositions()` (read-only cached fetch)
- Typing a string that matches neither library shows "Add 'X'" as the last option → creates a `user_tags` row scoped to that user (existing user-local behaviour preserved). The user's input becomes their custom tag — not exposed to other users; promotion to the canonical library is a curator action.
- Used by `LogSessionForm` and `SessionDetailModal` (the latter previously had no tag UI — adding it also fixed a latent bug where edits silently wiped `user_tag_ids`).
- Keyboard: Enter selects first match or creates; Backspace on empty input removes last chip
- Used by: LogSessionForm — replaces the legacy `sub_skill_tag` freeform input

### `SessionSearchPanel`
Advanced filter panel (calendar page deep-dive) that calls `GET /api/sessions/search` with filter state. Filters: date range, gi/no_gi, heading, polarity, intensity, session_type, user_tag_id, free-text against notes.

### `RepRouletteFab`
Floating action button that cycles through `ROULETTE_DRILLS`. Suggests a random drill + pre-fills LogSessionForm with `defaultHeading`, `defaultSessionType`, and `defaultSubSkillTag`.

---

## Context & State

### `AuthContext`
- State: `token: string | null`, `isAuthenticated: boolean`
- Methods: `login(token)`, `logout()`
- Token persisted in `localStorage`
- Registers a 401 error handler on `api` client (triggers auto-logout)
- Hook: `useAuth()`

### `ProfileContext`
- State: `name: string | null`, `beltRank: BeltRank | null`, `stripes: number`, `intentionsEnabled: boolean`
- Method: `refreshProfile()` — fetches `GET /api/profile` and updates state
- Auto-fetches on mount and on online reconnect
- Hook: `useProfile()`

---

## Hooks

### `useAuth`
Re-exports `useAuth()` from `AuthContext.tsx`.

### `useCountUp`
Animation hook for number counting (requestAnimationFrame, 800ms ease-out). Not REST-dependent.

### `use-toast`
State-based toast notification system with reducer pattern. Limits to 1 visible toast. Used for session logging feedback and offline sync status.

### `useOnlineSync`
Flushes the offline write queue when the browser comes back online.
- Listens to `window.addEventListener('online', ...)`
- Also flushes on mount (handles: app reopened while online, but queue has items from a previous offline session)
- Shows toast notifications: "Syncing N action(s)…", "N action(s) synced", or "N action(s) failed to sync"
- Dispatches `journada:online-ready` event after flush completes (even if no items were pending) — signals pages to refetch fresh data
- Mounted in `AppShell` — active on all authenticated pages

### `useOnlineRefetch`
Re-calls a given function when connectivity returns and the write queue has been flushed.
- Listens for `journada:online-ready` custom event
- Used by: PathAheadPage, CalendarPage, AnalyticsPage, ProfileContext
- One-line usage: `useOnlineRefetch(fetchAll)`

### `usePendingSessions`
Returns sessions logged while offline (not yet synced) for optimistic display.
- Reads from `pendingSessions.ts` localStorage store
- Listens for `journada:sessions-changed` event to re-render when a session is added
- Automatically clears pending sessions when `journada:online-ready` fires (sync completed)
- Used by: PathAheadPage, CalendarPage, AnalyticsPage, DashboardPage

### `useUserTags`
Manages the user's personal tag library — fetches on mount, exposes CRUD + Move Library helpers with optimistic local-state updates.
- State: `tags: UserTag[]` (sorted alphabetically), `loading`, `error`
- Returns: `{ tags, tagsByPillar, loading, error, refetch, createTag, attachVideo, detachVideo, patchVideoMeta }`
  - `tagsByPillar`: memoized `Record<Pillar, UserTag[]>` for pillar-grouped UI
  - `createTag(input)`: idempotent — server returns existing tag on name conflict, hook merges into local state
  - `attachVideo(id, file, notes?)`: full Move Library pipeline — validate file → probe duration → check quota → extract thumbnail → save blob locally → PATCH metadata. Returns the updated `UserTag` or `null` on any failure (with `error` set).
  - `detachVideo(id)`: removes local blob AND clears server metadata.
  - `patchVideoMeta(id, patch)`: lower-level — PATCH only. Use the `attachVideo` / `detachVideo` flows in normal UI.
- API: `GET /api/user-tags`, `POST /api/user-tags`, `PATCH /api/user-tags/:id/video`
- Used by: TagPicker, MovesLibraryPage

### `useIsDesktop`
Shared responsive breakpoint hook. Returns `true` when viewport >= 1024px (lg breakpoint).
- Uses `useSyncExternalStore` with `window.matchMedia('(min-width: 1024px)')`
- SSR-safe (server snapshot returns `false`)
- Used by: PathAheadPage, CalendarPage, AnalyticsPage, IntentionsPage, ProfilePage, JournalEntryPage

### `useBodyScrollLock`
Locks body scroll when a modal is open. Prevents background scrolling on mobile.

### `useUserTags`
Fetches and mutates the user's personal tag library. Backed by `GET/POST/PATCH/DELETE /api/user-tags`.
- Returns: `tags: UserTag[]`, `loading`, `createTag(name, parentPillar) → Promise<UserTag>`, `updateTag(id, patch)`, `deleteTag(id)`, `refresh()`
- Used by: TagPicker

### `useCanonicalPositions`
Fetches the curated canonical BJJ-position library once and caches via a module-level promise so all components share a single fetch per page load. Read-only.
- Returns: `positions: CanonicalPosition[]`, `byPillar: Record<Pillar, CanonicalPosition[]>` (precomputed), `byId: Map<string, CanonicalPosition>`, `loading`, `error`
- API: `GET /api/canonical-positions` (with ETag → 304 on revisit)
- Used by: TagPicker

---

## Library Utilities

### `lib/api.ts`
- `ApiError` class — extends Error, carries `status: number`
- `api.get/post/put/patch/delete(path, body?)` — injects Bearer token from localStorage
- `authErrorHandler` callback — triggered on 401, used by AuthContext for auto-logout
- **Offline queue integration:** when a write request (POST/PUT/PATCH/DELETE) fails with a network error, the request is enqueued in IndexedDB via `offlineQueue.ts` and a synthetic `{ message: 'Queued for sync.', _offline: true }` response is returned so the UI can proceed optimistically.
- **Offline read cache:** when a GET request fails (offline), falls back to the app-level IndexedDB cache (`apiCache.ts`) before throwing. Every successful GET response is cached (fire-and-forget) for offline fallback.

### `lib/apiCache.ts`
IndexedDB-based read cache for GET responses. Uses the `idb` package, separate `journada-cache` database from the write queue.
- `setCached(url, data)` — stores response keyed by full URL path (including query params)
- `getCached<T>(url)` — retrieves cached response; returns `null` if not found or expired (>24h)

### `lib/pendingSessions.ts`
localStorage-backed store for sessions logged while offline.
- `addPending(session)` — adds a `SessionSummary` to the pending list, dispatches `journada:sessions-changed` event
- `getPending()` — returns all pending sessions
- `clearPending()` — removes all pending sessions, dispatches `journada:sessions-changed` event

### `lib/offlineQueue.ts`
IndexedDB-based queue for offline write operations. Uses the `idb` package.
- `enqueue(method, path, body?)` — stores a `QueuedRequest` in the `journada-offline` database. For PATCH requests to the same path, replaces the existing entry (journal autosave deduplication).
- `count()` — returns number of pending items
- `flush()` — replays all queued requests in timestamp order. Removes items that succeed (any non-5xx response). Keeps items in queue on 401 (token expired — user needs to re-login). Stops on network error. Returns `{ synced, failed }`.

### `lib/constants.ts`
```ts
// Ordered clockwise to match Grappling Prism pentagon vertex positions
SKILL_TAGS = [
  { value: 'standup',     label: 'Stand-up'      },
  { value: 'passing',     label: 'Guard Passing' },
  { value: 'pins',        label: 'Dynamic Pins'  },
  { value: 'submissions', label: 'Submissions'   },
  { value: 'guard',       label: 'Guard'         },
]

ROULETTE_DRILLS   // 15 BJJ drill suggestions with focus areas (focus labels updated to match pillar names)
```
Type exports: `SkillTag`, `GiNogi`, `SessionType`, `SkillTagValue`

### `lib/haptics.ts`
Vibration API utility for tactile feedback on Android.
- `vibrate(ms: number)` — calls `navigator.vibrate()` if available, silent no-op on iOS/desktop
- Used by: PillarPrism (vertex snap 12ms, resonance tick 6ms, tap 8ms), LogSessionForm (intensity/duration/toggle 8-10ms), SessionDetailModal, SetIntentionModal

### `lib/pretextMeasure.ts`
Thin façade over `@chenglou/pretext` (pinned to v0.0.6) — pure-JS multiline text measurement and layout that doesn't trigger DOM reflows. Wrapper exists so:
1. Pretext's pre-1.0 API churn is contained behind one swap-out point.
2. Defensive try/catch returns `{ lines: [text], height: lineHeight }` if Pretext throws (font not loaded, missing OffscreenCanvas, etc.) — callers always get a sensible fallback.
3. Measurements are cached in a `Map<string, MeasureResult>` keyed on the full opts hash.
- API: `measureLines({ text, width, font, lineHeight }) → { lines: string[], height: number }`, `maxLinesHeight(texts[], shared) → number`
- Pretext flow internally: `prepareWithSegments(text, fontShorthand)` → `layoutWithLines(prepared, width, lineHeight)`. Both calls accept positional args, not options objects.
- Used by: `PathAheadPage` reflection card height stability, `JournalEntryPage` inscribe-reveal line breaks
- Browser-only (uses Canvas 2D for font measurement). The wrapper falls back gracefully in any non-browser environment.

### `lib/spring.ts`
Standardized spring physics system for the entire app. All motion should reference these presets so the UI feels cohesive ("made of the same physical material").
- **Presets:** `SPRING.snappy` (toggles), `SPRING.firm` (cards/sections, app default), `SPRING.heavy` (modals/belt, QuickBooks-adjacent weight), `SPRING.gentle` (particles/drifts)
- `animateSpring({ from, to, config, onUpdate, onComplete })` — rAF-based spring solver. Returns `{ stop() }` handle.
- `springToCss(config)` — converts spring config to approximate `cubic-bezier` + `duration` for CSS transitions.
- Spring equation: F = -kx - cv (stiffness, damping, mass per preset)

### `lib/belt.ts`
Shared BJJ belt types and constants used by both `BeltBar` and `BeltLoader`.
- `BeltRank` type: `'white' | 'blue' | 'purple' | 'brown' | 'black'`
- `BELT_COLORS`: hex colour per rank
- `PATCH_COLORS`: hex colour per rank (black belt gets red `#C41E3A`, all others dark)
- `ribbed(color)`: woven-fabric texture helper (1px dark line every 3px)

### `lib/theme.ts`
| Token | Value | Usage |
|---|---|---|
| `PAGE_BG` | `#0D1A14` | Page background (deep forest green) |
| `CARD_BG` | `#152E22` | Card backgrounds |
| `SURFACE_0` / `SURFACE_1` | aliases | `PAGE_BG` / `CARD_BG` |
| `SURFACE_2` | `rgba(255,255,255,0.035)` | Sub-section surface inside cards |
| `SURFACE_3` | `rgba(255,255,255,0.08)` | Interactive resting state |
| `SURFACE_2_BORDER` / `SURFACE_3_BORDER` | — | Paired borders for above surfaces |
| `PALE_YELLOW` | `#F2E4A8` | Champagne gold — title text, active states |
| `COPPER` | `#C4915F` | Warm caramel — card borders, wave strokes |
| `COPPER_BORDER` | `rgba(196,145,95,0.45)` | Card borders, accents |
| `PRESTIGE_GREEN` | `#00E67A` | 8th Gate milestone accent |
| `PRESTIGE_GREEN_GLOW` | `rgba(0,230,122,0.50)` | Green ring/glow composite |
| `PRESTIGE_TEAL` | `#00D4AA` | Greenish-blue prestige variant |
| `PRESTIGE_TEAL_GLOW` | `rgba(0,212,170,0.45)` | Teal glow composite |
| `CARD_SHADOW` | — | Layered card drop shadow |
| `CARD_GLOW` | — | Backlit ambient copper bloom (replaces COPPER_BORDER on major surfaces) |
| `CARD_GLOW_BORDER` | `rgba(196,145,95,0.08)` | Ghost border to pair with `CARD_GLOW` |
| `WHISPER_BORDER` | — | Subtle inset rim-light |
| `GLOW_TITLE` | — | Title text glow |
| `GLOW_SOFT` | — | Section heading glow |
| `GLOW_NAV` | — | Nav text glow |
| `HEATMAP_REST` | `#0A1610` | Rest/empty day cell |
| `HEATMAP_FUTURE` | `#08120D` | Future day cell |
| `HEATMAP_OUTSIDE_YEAR` | `#0D1812` | Outside-year cell |
| `HEATMAP_HEADER_BG` | `#111D16` | Sticky calendar header row |
| `DATE_INPUT_STYLE` | object | Inline style bundle for `<input type="date">` (dark colour scheme) |

### `lib/analyticsModels.ts`
Analytics math utilities for the deep-dive cards. Fail-safe on low-data users.
- `computeEntropy(sessions) → EntropyResult` — Shannon entropy on pillar distribution (diversity score)
- `computeACWR(sessions) → ACWRResult` — acute:chronic workload ratio (7-day vs 28-day)
- `computeDecay(sessions) → DecayResult[]` — per-pillar "rustiest" score based on days since last training
- `rustiest(decay)` — picks the pillar with the largest decay

### `lib/particles.ts`
Ambient particle systems for the home page and achievements.
- `INTENT_PARTICLES`, `STATS_PARTICLES` — static presets for intention card + stat strip
- `generateDayParticles(dayStr)` — seeded random per-day particles
- `generateBurstParticles(count, options)` — radial burst for 8th Gate / 26-week achievement unlocks
- `seededRandom(seed, index)` — hash-based pseudo-random (stable across renders)

### `lib/csvParser.ts`
- PapaParse wrapper for CSV import
- Exports `parseCSV(file, existingDates, onDone, onError, dateFormat)` — parses file, classifies headers, maps values to `ParsedRow[]`
- Exports `classifyHeader()` — reused by `.numbers` parser for column detection
- Supports `Tags` column (semicolon-separated), `DateFormat` selector (`auto`/`mdy`/`dmy`)
- Duration heuristic: bare numbers >12 = minutes, ≤12 = hours
- Exports types: `ParsedRow`, `ColKey`, `DateFormat`, `GiNogi`, `SessionType`, `SkillTagValue`

### `lib/jsonParser.ts`
- Parses `.json` files — accepts plain array or `{ sessions: [...] }` wrapper
- Maps objects to `ParsedRow[]` with same defaults as CSV parser
- No external dependencies (native `JSON.parse`)

### `lib/numbersParser.ts`
- Parses Apple Numbers `.numbers` files via SheetJS (lazy-loaded, ~143KB gzipped chunk)
- Auto-detects the Training Log weekly-grid format (Mon–Sun columns) and delegates to `trainingLogParser.ts`
- Falls back to standard column-per-field parsing for regular spreadsheets
- Reuses `classifyHeader()` from `csvParser.ts`

### `lib/trainingLogParser.ts`
- Dedicated parser for the original Training Log weekly-grid `.numbers` format
- Extracts individual sessions from Mon–Sun cells like `"5th Oct-2.5HR"`, `"March 22nd-3"`
- Tracks year/month context from the Month column, resolves year boundaries
- Handles typos (`Aprt`), em-dashes, bare ordinals, mixed date formats
- Carries weekly Goals/Drilling + Restriction + Long-term goals + Milestones as session notes

### `lib/videoStore.ts`
- Persistent local storage for Move Library video blobs (Sprint 7 Tier 1)
- **Strategy:** OPFS (Origin Private File System) when supported, IndexedDB fallback. Capability detection cached per session.
- API: `saveVideo(id, blob)`, `loadVideo(id)`, `deleteVideo(id)`, `hasVideo(id)`, `listVideoIds()`
- Quota helpers: `getStorageEstimate()` returns `{ usageBytes, quotaBytes, usagePercent, supported }`; `hasQuotaFor(bytes)` returns boolean with a 10% safety margin
- Files keyed by `user_tag.id`. Format is whatever the device captured (typically MP4/H.264 on iOS, WebM on desktop Chrome).

### `lib/videoUtils.ts`
- Pre-flight processing for video files before save (Sprint 7 Tier 1)
- `validateVideoFile(file)`: checks MIME prefix + 50MB cap
- `probeVideo(blob)`: returns `{ durationSeconds, width, height }` via hidden `<video>` + `loadedmetadata` event. 60-second duration cap. 10s timeout for corrupt files.
- `extractThumbnail(blob)`: seeks to ~0.1s past start (skips leading black frames), draws onto a canvas resized to 320px longest edge, returns ~5–15KB JPEG data URL at quality 0.7
- Formatters: `formatDurationMMSS(seconds)`, `formatBytes(bytes)`

### `lib/utils.ts`
- `cn(...inputs)` — `clsx` + `tailwind-merge` className composer

---

## Theme & Design Language

- **Deep forest green palette** — dark green surfaces (`#0D1A14` page, `#152E22` cards), copper/gold accents
- **Champagne gold** (`#F2E4A8`) for primary labels and active navigation
- **Warm caramel** (`#C4915F`) for borders, wave strokes, and the default loading animation
- **Particle animations** — rising particles in intention strips and summary cards
- **Belt bar** — always visible in header as a persistent identity element; copper drop-shadow for dark belt visibility
- **Belt-tying loader** — looping belt-tying animation replaces grappling figures as the app's loading indicator
- **Wave background** — animated seigaiha pattern, visible behind header
- **Copper resonance glow** — used on days/cards where training aligns with active intention
- **Premium easing** — `ease-heavy` (car door closing), `ease-spring` (overshoot), `ease-luxury` (long tail decel). The canonical "iOS-native spring" curve `cubic-bezier(0.34, 1.56, 0.64, 1)` is used by Prism micro-interactions (toggle pump, snap-in, dot pump) — matches SwiftUI's `interactiveSpring()` feel. See `project/J2/implementation-plans.md` "Animation Pattern Libraries" for the SwiftUI-Animations reference bar.
- **Page transitions** — `PageTransition` wrapper fades routes in/out with vertical slide
- **Glassmorphism modals** — `backdrop-filter: blur(16px)` on forest green at full `rgba(13, 26, 20, 1)` opacity (bumped from 0.97 to eliminate wave-pattern leak through the backdrop)
- **Named keyframes** (in `index.css`) — `j2-streak-sheen` (streak cell glint sweep), `j2IntentCopperPulse` (active vertex halo), `j2IntentParticleRise` (rising stat particles), `j2PrestigeBreathe` (26-week aura), `j2VertexToggle` / `j2VertexSnapIn` / `j2VertexDotPump` (Prism micro-interactions), `j2InscribeLine` (journal line-by-line reveal), `j2-seigaiha-drift` (wave pattern). All have `prefers-reduced-motion` overrides.

---

## Mobile & iOS Baseline

Global rules that make the PWA feel native on iOS Safari and prepare the codebase for the upcoming Capacitor shell (see [roadmap.md](roadmap.md) Sprint 7).

### Viewport (`index.html`)

```html
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, viewport-fit=cover" />
```

`viewport-fit=cover` is **required** for any `env(safe-area-inset-*)` CSS to evaluate to non-zero. Without it, all the safe-area handling in AppShell, modals, and pages becomes a silent no-op. **Note:** `maximum-scale=1.0` is currently set (a11y warning); flagged in roadmap for removal.

### Global CSS (`src/index.css` `@layer base`)

| Rule | Scope | Why |
|---|---|---|
| `-webkit-tap-highlight-color: transparent` | `*` | Kills the gray tap-flash on touch — web-app tell #1. |
| `-webkit-touch-callout: none` | `button, a, [role="button"], [role="tab"], [role="menuitem"]` | Blocks long-press callout menus on interactive chrome. |
| `touch-action: manipulation` | Same as above | Removes 300ms tap delay on iOS without disabling page-level pinch-zoom. |
| `user-select: none` | `button, [role="button"]` | Prevents accidental text selection during taps. |
| `overscroll-behavior: none` | `html, body` | Disables rubber-band on the page itself. Scroll containers can opt in to rubber-band via `overscroll-behavior: contain`. |
| `-webkit-text-size-adjust: 100%` | `body` | Stops iOS Safari from auto-bumping text size on orientation change. |
| `-moz-osx-font-smoothing: grayscale` | `body` | Pairs with existing `-webkit-font-smoothing: antialiased` for consistent rendering. |

### Safe-Area Insets

CSS variables `--sat`, `--sar`, `--sab`, `--sal` are defined at `:root` in `src/index.css` for the four safe-area edges. Most surfaces consume `env(safe-area-inset-*)` directly via inline styles — see AppShell header (`paddingTop`), AppShell main content + bottom nav (`paddingBottom`), and all modals. Pattern:

```ts
paddingTop: 'max(1rem, env(safe-area-inset-top))',
paddingBottom: 'max(1rem, env(safe-area-inset-bottom))',
```

Modals also clamp `maxHeight` to `calc(100dvh - env(safe-area-inset-top, 0px) - env(safe-area-inset-bottom, 0px) - 2rem)` so content never extends under the notch or home indicator.

### iOS Keyboard Hints

Form inputs use the full set of iOS-relevant attributes for the right keyboard + autofill behavior. Standard pattern:

| Input type | Attributes |
|---|---|
| Email | `type="email"`, `inputMode="email"`, `autoComplete="email"`, `autoCapitalize="none"`, `autoCorrect="off"`, `spellCheck={false}`, `enterKeyHint="next"` (or `"go"`) |
| Password (login) | `type="password"`, `autoComplete="current-password"`, `enterKeyHint="go"` |
| Password (register/reset) | `type="password"`, `autoComplete="new-password"`, `enterKeyHint="next"` (or `"go"`) |
| Search | `type="search"`, `inputMode="search"`, `enterKeyHint="search"`, `autoCapitalize="none"`, `autoCorrect="off"` |
| Name | `autoComplete="name"`, `autoCapitalize="words"`, `enterKeyHint="next"` |

Applied across `HomePage` (auth), `ResetPasswordPage`, `ProfilePage` (name + gym), `JournalIndexPage` (search). Add the matching set to any new form input.

### Tap Targets

Apple HIG minimum is **44pt × 44pt** for any interactive element. Audited surfaces all comply. When adding new buttons/chips, use `w-11 h-11` minimum on mobile (44px in Tailwind default scale) — `w-10 h-10` (40px) is below threshold.

---

## Admin Dashboard + Support Cases (mig 023)

Single-admin troubleshooting surface. Adds a `/admin` page (founder-only,
gated by `useProfile().isAdmin`) and a "Report a Problem" modal accessible
from the profile page for any authed user.

### Pages / components

- **`AdminDashboardPage`** (`src/app/AdminDashboardPage.tsx`) — route `/admin`. Health strip (8 stats) + cases queue (status filter chips, inline-expand to read description / debug context, change status, edit admin notes) + recent users + system info. Guards on `useProfile().isAdmin` — redirects non-admins to `/home` via `<Navigate replace />`. Backend gating on `/api/admin/*` provides defense in depth.
- **`ReportProblemModal`** (`src/components/ReportProblemModal.tsx`) — opened from the profile page's "Report a problem" button. Two fields (subject + description). Auto-attaches `window.location.href`, `navigator.userAgent`, `VITE_APP_VERSION` at submit time. Modal chrome mirrors `CsvImportModal` (z-[60], opaque backdrop + 12px blur, `animate-j2-backdrop-in` + `animate-j2-modal-in`).

### Profile page additions

- **Admin Dashboard link** — visible only when `isAdmin === true`. Routes to `/admin`. Coppered outlined button styling, shown above the Report button on both desktop and mobile.
- **Report a Problem button** — visible to all authed users. Opens `ReportProblemModal`. Subtle outlined treatment so it doesn't compete with primary actions.

### State / context

- **`ProfileContext`** extended with `isAdmin: boolean` (`src/context/ProfileContext.tsx`). Read from `profile.is_admin` on the API response. Defaults `false`.
- **`ProfileResponse.profile.is_admin?: boolean`** added to `src/types/api.ts`. Optional for legacy rows that predate migration 023 (the column is `NOT NULL DEFAULT false` so this should be present in practice).
- **New types** in `src/types/api.ts`: `CaseStatus`, `CaseSeverity`, `SupportCase`, `SupportCaseWithUser`, `AdminStats`, `AdminUserSummary`, response wrappers.

### Routing

- `/admin` registered in `App.tsx` inside `<ProtectedShell>`. The OnboardingGate wrapper applies — admins must complete onboarding before reaching `/admin`.
