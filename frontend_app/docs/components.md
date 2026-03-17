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

### `ResetPasswordPage.tsx`
Password reset confirmation screen. Reads the `token` query param from the URL (e.g. `/reset-password?token=abc123`).

Fields: new password + confirm password (both min 8 characters). Submits to `POST /auth/reset-password`. On success shows a confirmation with a "Go to Log In" button. On failure shows the exact error from the backend (e.g. "This reset link is invalid or has expired.").

### `PathAheadPage.tsx`
Main view after login. Composed of:
- Header: logo, `BeltBar`, Profile and Logout buttons
- **Mat Time** section: `TrainingHeatmap` + "+ Mat Time" button
- `LogSessionForm` modal (hidden until triggered)

Fetches `/api/sessions` and `/api/profile` on mount.

### `CalendarPage.tsx`
Calendar view of training sessions.

### `AnalyticsPage.tsx`
Full analytics view powered by `SkillRadar`.

### `IntentionsPage.tsx`
Weekly intention setting. Lets the user define a short focus label and category for the current week. Calls `POST /api/intentions` and `GET /api/intentions`.

### `JournalEntryPage.tsx`
Reflection journal for a specific intention. Route: `/intentions/:id/journal`.

### `ProfilePage.tsx`
Edit profile: display name, belt rank, stripes (0–4), home gym with Google Places Autocomplete. Calls `PUT /api/profile` on save.

---

## Components

### `SkillRadar.tsx`

Analytics instrument with four views, a vertical icon rail, and animated transitions.

**Props**: `sessions: SessionSummary[]`

**Views**

| ID | Title | Chart | Data source |
|---|---|---|---|
| `prism` | The Grappling Prism | Pentagon radar (SVG) | `tags` array per session |
| `volume` | Volume by Month | Bar chart (SVG) | `duration` grouped by month |
| `split` | The Two Worlds | Donut (SVG) | `gi_nogi` field |
| `format` | Session Format | Donut (SVG) | `session_type` field |

**Time windows**: `30d` · `60d` · `90d` · `all`
Stored in state as `TimeWindow = '30d' | '60d' | '90d' | 'all'`.

**Layout**
- Header row: view title (left) + time window buttons (right) — single combined row
- Below header: subtitle reveal row (triangle trigger + text, outside the drum so it can overflow freely)
- Body: animated drum (flex-1) | right rail column (toggle above icons, vertically centered)

**Display toggle** (h / %): stored as `displayMode = 'hours' | 'pct'`. Affects breakdown rows (raw hours vs percentage). Lives in the rail column above the view icons. On the Volume view (where it doesn't apply), collapses to a thin pale yellow line via `scaleY(0.04)` CSS transition — border goes transparent, background fills to `PALE_YELLOW`. Returns to full pill when leaving Volume.

**View transition mechanics**
- Exit: 500ms, `cubic-bezier(0, 0, 0.3, 1)` (fast-start, clears immediately)
- Enter: 560ms, `cubic-bezier(0.2, 1.1, 0.4, 1)` (spring bounce), 120ms delay
- Direction: `slideDir` computed from rail index before state update — slides up when moving to a higher rail item, down when moving lower
- React `key` not used; instead, `prevViewMode` state holds the exiting panel while `viewMode` holds the entering panel. `onAnimationEnd` on the entering panel clears `prevViewMode`.
- Animated panels contain chart + breakdown rows only (title is static in the card header)

**Skill colors** (radar chart polygon, prism view)

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

**Breakdown bar animation**
In hours mode, the separator between label and value expands into a proportional horizontal bar (5px tall). In % mode, it shrinks back to a thin vertical sliver (13px tall). Animated via CSS `transition` on `width`, `height`, and `border-radius`.

**Subtitle easter egg**
Each view has a subtitle hidden behind a triangle icon. Rendered outside the drum (to allow overflow) in a fixed-height container — the longest subtitle (prism) acts as an invisible spacer so the card height never shifts. Hover the triangle to reveal (700ms fade-in). Fades out instantly (80ms) on view change. `subtitleRevealed` resets to false on every view change via `useEffect`.

---

### `TrainingHeatmap.tsx`

Year-at-a-glance session calendar.

**Props**: `sessions: SessionSummary[]`

**`SessionSummary` type**
```ts
{
  id: string;
  date: string | Date;
  duration: number;        // minutes
  gi_nogi: 'gi' | 'no_gi';
  intensity: number;       // 1–5
  session_type: string;
  notes?: string;
  tags?: string[];
}
```

Grid layout: rows are days of the year, grouped by month column. Each cell is coloured by the day's max intensity. Click a cell → `SessionDetailModal`.

---

### `BeltBar.tsx`

Animated BJJ belt tying sequence. Plays once on mount.

**Animation sequence** (CSS keyframes + JS timeouts):
1. Belt slides in from left (500ms)
2. Knot appears at center (300ms)
3. Tails drop with pendulum swing (480ms)
4. After animation: tails become draggable (easter egg)

**Belt colors**

| Rank | Hex |
|---|---|
| white | `#C8C4BF` |
| blue | `#1E4D8C` |
| purple | `#6B2D8B` |
| brown | `#7B4A2D` |
| black | `#1C1C1C` |

Stripes (0–4) are rendered as white rectangles near the right tail.

---

### `LogSessionForm.tsx`

Modal for logging a new session. Controlled form with local state.

Fields: date (default today), duration (preset buttons: 1h / 1h30 / 2h / 2h30 / 3h, or custom hours+minutes input), session type, Gi/No-Gi, intensity slider (1–5), notes, skill tags (multi-select).

Submits to `POST /api/sessions`. On success: calls `onSessionLogged()` prop to refresh the parent's session list, shows success toast, closes modal.

---

### `SessionDetailModal.tsx`

View/edit a session. Opened from `TrainingHeatmap` on cell click.

Read mode: displays all session fields. Edit mode: replaces display with form inputs. Submits to `PUT /api/sessions/:id`.

---

### `WaveBackground.tsx`

Animated seigaiha (Japanese wave/fish-scale) SVG pattern. Used in `PathAheadPage`, `HomePage`, and `ResetPasswordPage`.

Pattern: 36×36px repeating tile of concentric semicircular arcs in copper at varying opacity. Animates with a slow horizontal + vertical drift (14s loop, `cubic-bezier` easing).

---

### `AppShell.tsx`

Wraps all authenticated pages. Renders the nav bar and the page content area. Protected by `ProtectedShell` in `App.tsx` — redirects to `/` if no token is present.

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

## UI Primitives (`components/ui/`)

Thin wrappers around Radix UI + shadcn/ui primitives, styled with Tailwind.

| File | Purpose |
|---|---|
| `tooltip.tsx` | Radix Tooltip — used in rail icon buttons and info icons |
| `select.tsx` | Radix Select — belt rank dropdown in ProfilePage |
| `toast.tsx` + `toaster.tsx` | Toast notifications (session logged, profile saved) |
| `badge.tsx` | Pill badge for tags/labels |

---

## Lib

| File | Exports | Notes |
|---|---|---|
| `lib/api.ts` | `api.get()`, `api.post()`, `api.put()`, `api.patch()`, `api.delete()`, `ApiError` | Injects JWT; global 401 handler triggers logout; throws `ApiError` with backend message on non-2xx |
| `lib/constants.ts` | `SKILL_TAGS` | Canonical skill tag values + labels |
| `lib/theme.ts` | `PAGE_BG`, `CARD_BG`, `PALE_YELLOW`, `COPPER`, `COPPER_BORDER`, `CARD_SHADOW`, `GLOW_TITLE`, `GLOW_SOFT`, `GLOW_NAV`, heatmap tokens | All color/shadow tokens |
| `lib/utils.ts` | `cn()` | `clsx` + `twMerge` for dynamic Tailwind classes |

---

## Custom Tailwind Animations (`tailwind.config.ts`)

| Class | Duration | Easing | Use |
|---|---|---|---|
| `animate-view-exit-up` | 500ms | `cubic-bezier(0,0,0.3,1)` | Panel exiting upward |
| `animate-view-exit-down` | 500ms | `cubic-bezier(0,0,0.3,1)` | Panel exiting downward |
| `animate-view-enter-up` | 560ms + 120ms delay | `cubic-bezier(0.2,1.1,0.4,1)` | Panel entering from below |
| `animate-view-enter-down` | 560ms + 120ms delay | `cubic-bezier(0.2,1.1,0.4,1)` | Panel entering from above |
| `animate-toggle-exit` | 420ms | `cubic-bezier(0.4,0,0.8,0.2)` | (defined, unused — toggle now uses CSS `transition`) |
| `animate-toggle-enter` | 480ms | `cubic-bezier(0.2,1.1,0.4,1)` | (defined, unused — toggle now uses CSS `transition`) |
