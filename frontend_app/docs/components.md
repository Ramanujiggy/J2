# Frontend Component Catalog

All components live in `src/components/`. Pages live in `src/app/`.

---

## Pages

### `HomePage.tsx`
Login / Register / Forgot Password page. Switches between three modes via a tab toggle and a "Forgot your password?" link.

**Modes**
- `login` — email + password → `POST /auth/login` → stores JWT, navigates to `/home`
- `register` — email + password → `POST /auth/register` → auto-login on success
- `forgot` — email only → `POST /auth/request-password-reset` → shows confirmation message

Error messages from the backend are displayed directly (not swallowed as a generic fallback).

---

### `ResetPasswordPage.tsx`
Password reset confirmation screen. Reads the `token` query param from the URL (e.g. `/reset-password?token=abc123`).

Fields: new password + confirm password (both min 8 characters). Submits to `POST /auth/reset-password`. On success shows a confirmation with a "Go to Log In" button. On failure shows the exact error from the backend (e.g. "This reset link is invalid or has expired.").

---

### `PathAheadPage.tsx`
The main home view after login. Composed of:

- **Intention banner** — shows the active weekly intention with animated purple glow, rising particles, category badge, and delete (two-step confirmation). Empty state with "+ Set intent" button when no intention is set. Thin glowing accent line when intentions are disabled.
- **Week navigation** — prev/next arrows + label (This week / Last week / date range for older weeks). Week offset state controls the 7-day window shown.
- **Day card stack** — 7 day cards rendered as an absolute z-stack. Active card drags freely with `rotateZ` tilt and a pivot at `transformOrigin: 50% 85%` (near card bottom, matching thumb position). Behind cards peek at scale 0.95/0.90 and translateY 10/20px. Swipe left/right (or tap the day indicator below) to navigate. RAF-throttled drag + velocity threshold for natural flick detection.
- **Day cards** (`DayCard` inline component) — each shows: date header, session intensity dot + duration + type + gi/no-gi + skill tags (if session), or contextual empty-state CTA ("+ Mat Time" / "Rest day · + Log session" / "+ Log"). Intention strip with particles at card bottom when intention is active for that day.
- **Day-initial indicator** — row of 7 letter buttons below the deck. Active day underline animates width/color.
- **Weekly summary** — session count, total duration, Training Telemetry prose sentence (top skill tag usage).
- **Rep Roulette** — random BJJ drill with `rotateX` flip animation on spin. Always visible (not gated on session data).

**State**: `sessions`, `intentions`, `weekOffset`, `activeDayIndex`, `dragX`, `isDragging`, modal states, `deleteConfirm`, `drillIndex`, `spinPhase`.

**Modals**: `LogSessionForm` (with `defaultDate` for tapping empty day cards), `SessionDetailModal`, `SetIntentionModal`.

---

### `CalendarPage.tsx`
Year-at-a-glance view. Contains `TrainingHeatmap` for the selected year with prev/next year navigation (future years disabled). Click any day cell → `SessionDetailModal`. Fetches all sessions on mount.

---

### `AnalyticsPage.tsx`
Full analytics view powered by `SkillRadar`. Contains an **Intention vs Training Telemetry** section below the radar: a collapsible table comparing each week's set intention category against the actual top-logged skill tag. Toggle show/hide. Fetches sessions and intentions on mount.

---

### `IntentionsPage.tsx`
Historical list of all weekly intentions. Table layout: Week · Intention + category badge · Training Telemetry (top tag for that week) · Journal link. Empty state if none set. "Disabled" notice if `intentions_enabled = false`.

---

### `JournalEntryPage.tsx`
Reflection journal for a specific intention. Route: `/intentions/:id/journal`.

- Loads intention by ID. Displays: intent label, week, category, duration days.
- Large textarea. **Autosaves on 1.5s debounce** via `PATCH /api/intentions/:id/journal`. Shows "Saving…" / "Saved ✓" status.
- Manual Save button (only shown if `intentionsEnabled`).
- Read-only if intentions disabled.
- Back button → `/intentions`.

---

### `ProfilePage.tsx`
User settings. Sections:

- **Profile form**: name, belt rank dropdown (white/blue/purple/brown/black), stripes selector (0–4, hidden for white belt), home gym address (Google Maps Places autocomplete, optional — requires `VITE_GOOGLE_MAPS_API_KEY`).
- **Features**: Intentions enabled/disabled toggle.
- **Import training history**: opens `CsvImportModal`.
- **Log out** button.

Calls `GET /api/profile` on mount and `PUT /api/profile` on save.

---

## Components

### `LogSessionForm.tsx`

Modal for logging a new session. Controlled form with local state.

**Props**
| Prop | Type | Notes |
|---|---|---|
| `onSuccess` | `() => void` | Called after successful save — refreshes session list and closes |
| `onCancel` | `() => void` | Called on cancel / close |
| `defaultDate` | `string?` | YYYY-MM-DD — pre-fills the date field when tapping an empty day card |

**Fields**: date (default today in local timezone), Gi/No-Gi buttons, session type (Class / Drilling / Competition), duration (preset buttons: 1h / 1h30 / 2h / 2h30 / 3h, or custom hours+minutes), intensity slider (1–5), skill tags (multi-select, at least 1 required), notes textarea.

Submits to `POST /api/sessions`. Shows validation errors inline.

---

### `SessionDetailModal.tsx`

View and edit a session. Opened from `TrainingHeatmap` on cell click, or from `PathAheadPage` day cards.

**Props**
| Prop | Type | Notes |
|---|---|---|
| `session` | `SessionSummary` | Session to display |
| `date` | `Date` | Session date |
| `intention` | `Intention \| null` | Active intention for that day (if any) |
| `sessionCount` | `number` | Total sessions on this date |
| `sessionIndex` | `number` | Current session index (for multi-session days) |
| `onNavigate` | `(index: number) => void` | Navigate between sessions on the same date |
| `onClose` | `() => void` | |
| `onSaved` | `() => void` | Called after update or delete — refreshes parent |

Read face: displays all fields. Edit face: full editable form (same fields as LogSessionForm). Delete button with confirmation. Card-flip animation between view and edit faces using 3D `rotateY` — the entire card (background + border) flips, not just the content. Submits to `PUT /api/sessions/:id` or `DELETE /api/sessions/:id`.

---

### `SetIntentionModal.tsx`

Create a new weekly intention.

**Props**
| Prop | Type | Notes |
|---|---|---|
| `weekStart` | `Date` | The week to set the intention for |
| `onSaved` | `() => void` | Called on success — refreshes intention data |
| `onClose` | `() => void` | |

**Fields**: intent label (max 20 chars, live character count), intent category select (technical / physical / mental / positional / competitive), duration days slider (1–30, default 7).

Submits to `POST /api/intentions`. Surfaces `409` conflict clearly if an intention already exists for the week.

---

### `TrainingHeatmap.tsx`

Year-at-a-glance session calendar.

**Props**
| Prop | Type | Notes |
|---|---|---|
| `sessions` | `SessionSummary[]` | All sessions |
| `intentions` | `Intention[]` | All intentions (for highlight overlay) |
| `loading` | `boolean` | Shows skeleton while loading |
| `onSessionUpdated` | `() => void` | Called after session edit/delete |
| `onGoToToday` | `() => void` | Called when "today" button is tapped |
| `year` | `number` | Calendar year to display |

Grid layout: columns are weeks of the year. Each cell represents one day, coloured by max session intensity. Click any cell → `SessionDetailModal`. Intention ranges optionally highlighted. Sticky month headers. Wrapped in `ErrorBoundary`.

**`SessionSummary` type**
```ts
{
  id: string;
  date: string | Date;
  duration: number;         // minutes
  gi_nogi: 'gi' | 'no_gi';
  intensity: number;        // 1–5
  session_type: string;
  notes?: string;
  tags?: string[];
}
```

**Intensity colours**

| Intensity | Colour |
|---|---|
| Rest / no session | `HEATMAP_REST` (`#0d1a26`) |
| Easy (1–2) | `#CDDFA0` light green |
| Moderate (3) | `#6FD08C` green |
| High (4–5) | `#DA7422` orange |

---

### `SkillRadar.tsx`

Analytics instrument with four views, a vertical icon rail, time windows, and animated transitions.

**Props**: `sessions: SessionSummary[]`

**Views**

| ID | Title | Chart | Data source |
|---|---|---|---|
| `prism` | The Grappling Prism | Pentagon radar (SVG) | `tags` array per session |
| `volume` | Volume by Month | Bar chart (SVG) | `duration` grouped by month |
| `split` | The Two Worlds | Donut (SVG) | `gi_nogi` field |
| `format` | Session Format | Donut (SVG) | `session_type` field |

**Time windows**: `30d` · `60d` · `90d` · `all`

**Display toggle** (h / %): affects breakdown rows. On Volume view (where it doesn't apply), morphs into a thin pale yellow line and slides into the rail border — reverses on exit.

**View transition mechanics**
- Exit: 500ms, `cubic-bezier(0, 0, 0.3, 1)` (fast-start)
- Enter: 560ms, `cubic-bezier(0.2, 1.1, 0.4, 1)` (spring bounce), 120ms delay
- Direction: computed from rail index — slides up toward lower-indexed views, down toward higher

**Skill colors** (prism radar polygon)

| Skill | Fill | Stroke |
|---|---|---|
| standup | amber/25% | amber/75% |
| guard_retention | cyan/25% | cyan/75% |
| submissions | red/25% | red/75% |
| pin_escapes | purple/25% | purple/75% |
| guard_passing | blue/25% | blue/75% |

**Segment colors** (donut charts)

| Segment | Color |
|---|---|
| Gi | `rgba(111,208,140,0.80)` green |
| No-Gi | `rgba(218,116,34,0.80)` orange |
| Class | `rgba(111,208,140,0.80)` green |
| Drilling | `rgba(240,223,160,0.65)` pale yellow |
| Competition | `rgba(220,90,80,0.80)` red |

**Subtitle easter egg**: each view has a subtitle hidden behind a triangle icon. Hover to reveal (700ms fade-in). Fades out on view change.

Wrapped in `ErrorBoundary`.

---

### `BeltBar.tsx`

Animated BJJ belt tying sequence. Plays once on mount.

**Props**: `rank: BeltRank | null`, `stripes: number` (0–4)

**Animation sequence** (CSS keyframes + JS timeouts):
1. Belt slides in from left (500ms)
2. Knot forms at center (300ms, 65ms delay)
3. Tails drop with pendulum swing (480ms, 120ms delay for right tail)
4. Sparks animate (380ms, 270ms delay)
5. After animation: tails become draggable (easter egg) — hover + drag to follow cursor; click for whip-and-snap animation

**Belt colors**

| Rank | Hex |
|---|---|
| white | `#C8C4BF` |
| blue | `#1E4D8C` |
| purple | `#6B2D8B` |
| brown | `#7B4A2D` |
| black | `#1C1C1C` |

Stripes rendered as white diagonal rectangles near the right tail.

---

### `BeltDateBanner.tsx`

Belt-colored date input that replaces a plain `<input type="date">`. Renders
the user's current belt rank (color + stripes) as a banner, then opens the
native date picker when tapped. Plays a **Venetian-blind unfurl** on mount
via GSAP — the belt appears to be laid down section by section from left to
right.

**Props**
| Prop | Type | Notes |
|---|---|---|
| `value` | `string` | YYYY-MM-DD |
| `onChange` | `(date: string) => void` | Called on every native picker change |
| `required` | `boolean?` | Forwarded to the hidden `<input>` |

**Anatomy**
- **9 belt-body slices** — absolute-positioned divs covering the left portion of the banner (everything except the patch zone). Each gets a ribbed background via `ribbed()` from `lib/belt.ts`.
- **1 patch slice** — rightmost 52 px, `PATCH_COLORS[rank]` background, contains 0–4 white stripe bars.
- **Date text overlay** — absolutely-positioned `<span>` centred over the belt body; fades in after the belt has landed.
- **Transparent `<input type="date">`** — sits at `z-index: 10` over the entire banner, `opacity: 0`. Captures taps and opens the native picker without hiding the belt art.

**3D setup**

`perspective: 500px` is set on the parent wrapper. All slices share this vanishing point. `overflow: hidden` clips sub-pixel overshoot from the elastic spring so nothing bleeds outside the 48 px height.

**GSAP animation sequence** (fires once on mount)

| Step | Target | Property | Value | Timing |
|---|---|---|---|---|
| `gsap.set` | slices + patch | `rotateX`, `opacity`, `transformOrigin` | `-90`, `0`, `'top center'` | Instant (pre-animation) |
| `gsap.set` | date text | `opacity` | `0` | Instant |
| Timeline step 1 | 9 belt slices | `rotateX → 0`, `opacity → 1` | `elastic.out(1, 0.65)`, 0.38 s, 40 ms stagger | Starts at t=0.04 s |
| Timeline step 2 | patch | `rotateX → 0`, `opacity → 1` | `elastic.out(1.1, 0.5)`, 0.32 s | Starts 35% before step 1 end |
| Timeline step 3 | date text | `opacity → 1` | `power2.out`, 0.25 s | 80 ms after step 2 starts |

Each slat carries `inset box-shadow: 0 2px rgba(255,255,255,0.28), 0 -2px rgba(0,0,0,0.20)` to simulate the top-edge catch-light and inner bottom-shadow of real fabric — giving perceived thickness without SVG or canvas.

**Reads from**: `ProfileContext` (`beltRank`, `stripes`); `lib/belt.ts` (`BELT_COLORS`, `PATCH_COLORS`, `ribbed`).

**Cleanup**: the GSAP timeline is killed in the `useEffect` teardown to prevent animation callbacks on unmounted components.

---

### `CsvImportModal.tsx`

Bulk import historical training data from a CSV file.

**Props**
| Prop | Type | Notes |
|---|---|---|
| `existingDates` | `Set<string>` | YYYY-MM-DD strings of existing sessions — used for duplicate flagging |
| `onClose` | `() => void` | |
| `onImported` | `() => void` | Called after successful import — triggers session refresh |

**Steps**: Upload → Review → Done

- **Upload**: File picker. Accepts `.csv`. Parses with PapaParse (client-side, no network).
- **Review**: Scrollable table, one row per parsed session. Flags: missing duration (blocks), bad date (blocks), duplicate date (warning). Inline editable: gi_nogi toggle, intensity buttons, session type, tags multi-select, skip checkbox. "Fix all missing durations" → default 60 min.
- **Done**: Shows count of imported / skipped. Auto-closes or user taps Done.

Column auto-detection (case-insensitive):

| CSV column | Maps to |
|---|---|
| `Date`, `date` | `date` (normalised to YYYY-MM-DD) |
| `@Hrs`, `Hrs`, `Duration`, `Hours` | `duration` (decimal hours → minutes) |
| `Goals/Drilling`, `Notes`, `Focus` | `notes` |
| `Restriction` | prepended to `notes` as `[Restriction: …]` |
| `Hrs-Running total`, `Running Total` | ignored |

Submits to `POST /api/sessions/import` (atomic, max 500 rows).

---

### `WaveBackground.tsx`

Animated seigaiha (Japanese wave / fish-scale) SVG pattern. Used on `HomePage` and `ResetPasswordPage`.

Pattern: 36×36px repeating tile of concentric semicircular arcs in copper at varying opacity. Animates with a slow horizontal + vertical drift (14s loop, `cubic-bezier` easing).

---

### `AppShell.tsx`

Wraps all authenticated pages. Renders the navigation bar (bottom tabs on mobile, side rail on wider screens) and the page content area. Includes the `Toaster` for toast notifications. Protected by `ProtectedShell` in `App.tsx` — redirects to `/` if no token is present.

---

### `ErrorBoundary.tsx`

React class-based error boundary wrapping `TrainingHeatmap` and `SkillRadar`. Catches render errors and displays a minimal fallback instead of crashing the page.

---

## Routing (`App.tsx`)

| Path | Component | Protected |
|---|---|---|
| `/` | `HomePage` | No |
| `/reset-password` | `ResetPasswordPage` | No |
| `/home` | `PathAheadPage` | Yes |
| `/calendar` | `CalendarPage` | Yes |
| `/analytics` | `AnalyticsPage` | Yes |
| `/intentions` | `IntentionsPage` | Yes |
| `/intentions/:id/journal` | `JournalEntryPage` | Yes |
| `/profile` | `ProfilePage` | Yes |
| `/dashboard` | Redirect → `/home` | — |

Protected routes are wrapped in `ProtectedShell`, which checks `isAuthenticated` from `AuthContext` and redirects to `/` if no token is present.

---

## Context Providers

### `AuthContext`
- **State**: `token: string | null`, `isAuthenticated: boolean`
- **Methods**: `login(token)` — saves to localStorage; `logout()` — removes from localStorage
- **Auto-logout**: global 401 handler in `api.ts` triggers `logout()` and redirects to `/`

### `ProfileContext`
- **State**: `beltRank`, `stripes`, `intentionsEnabled`, `refreshProfile()`
- **Initialization**: fetches `GET /api/profile` on mount
- **Usage**: gates intention UI throughout the app; refreshed after profile save

---

## Lib

| File | Exports | Notes |
|---|---|---|
| `lib/api.ts` | `api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()`, `ApiError` | Injects JWT; global 401 handler triggers logout; throws `ApiError` with backend message on non-2xx |
| `lib/constants.ts` | `SKILL_TAGS`, `ROULETTE_DRILLS` | Skill tag values + labels; 15 BJJ drills with focus and rep suggestion |
| `lib/theme.ts` | `PAGE_BG`, `CARD_BG`, `PALE_YELLOW`, `COPPER`, `COPPER_BORDER`, `CARD_SHADOW`, `GLOW_TITLE`, `GLOW_SOFT`, `GLOW_NAV`, heatmap tokens | All color/shadow tokens — never hard-code colours in components |
| `lib/utils.ts` | `cn()` | `clsx` + `twMerge` for dynamic Tailwind classes |
| `lib/csvParser.ts` | CSV parsing utilities | Column detection, date normalisation, row transformation for `CsvImportModal` |
| `lib/belt.ts` | `BELT_COLORS`, `PATCH_COLORS`, `BeltRank`, `ribbed()` | Belt rank color maps and CSS ribbed-background generator used by `BeltBar` and `BeltDateBanner` |

---

## UI Primitives (`components/ui/`)

Thin wrappers around Radix UI + shadcn/ui primitives, styled with Tailwind.

| File | Purpose |
|---|---|
| `tooltip.tsx` | Radix Tooltip — used in rail icon buttons and info icons |
| `select.tsx` | Radix Select — belt rank dropdown in ProfilePage |
| `toast.tsx` + `toaster.tsx` | Toast notifications (session logged, profile saved) |
| `badge.tsx` | Pill badge for tags / labels |

---

## Custom Tailwind Animations (`tailwind.config.ts`)

| Class | Duration | Easing | Use |
|---|---|---|---|
| `animate-view-exit-up` | 500ms | `cubic-bezier(0,0,0.3,1)` | Panel exiting upward |
| `animate-view-exit-down` | 500ms | `cubic-bezier(0,0,0.3,1)` | Panel exiting downward |
| `animate-view-enter-up` | 560ms + 120ms delay | `cubic-bezier(0.2,1.1,0.4,1)` | Panel entering from below |
| `animate-view-enter-down` | 560ms + 120ms delay | `cubic-bezier(0.2,1.1,0.4,1)` | Panel entering from above |
| `animate-toggle-exit` | 420ms | `cubic-bezier(0.4,0,0.8,0.2)` | Defined but unused (toggle uses CSS `transition`) |
| `animate-toggle-enter` | 480ms | `cubic-bezier(0.2,1.1,0.4,1)` | Defined but unused (toggle uses CSS `transition`) |

> **GSAP (v3.14.2)** is used for imperative mount animations that need spring physics or per-element staggering — things CSS `@keyframes` cannot express cleanly. Currently only `BeltDateBanner` uses GSAP. Import it with `import gsap from 'gsap'`. Always kill timelines in the `useEffect` teardown: `return () => { tl.kill(); }`. See `BeltDateBanner.tsx` for the canonical pattern.
