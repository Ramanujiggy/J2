# Journada

A full-stack BJJ training tracker. See [`roadmap.md`](roadmap.md) for planned development areas. Log sessions, visualize skill development across five pillars, track volume trends, set weekly intentions, and reflect through journaling.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express 5 + TypeScript |
| Database | PostgreSQL on Supabase (via `pg` pool) |
| Auth | JWT (24h) + bcrypt (12 rounds) |
| Email | Nodemailer — Ethereal in dev, SMTP in production |
| Frontend | React 18 + Vite + TypeScript + Tailwind CSS 3 |
| UI primitives | Radix UI + shadcn/ui |
| CSV import | PapaParse (client-side) |
| Gym autocomplete | Google Maps Places API (optional) |
| Hosting | Railway (separate frontend + backend services) |

---

## Project Structure

See [`build-structure.md`](build-structure.md) for the architectural skeleton, key patterns, and a spin-up checklist for new projects.

```
J2/
├── package.json              Workspace root — husky pre-commit hook only
├── .husky/pre-commit         Runs backend tests before every commit
├── backend_api/              Node.js API server (port 5000)
│   ├── src/
│   │   ├── app.ts            Express config, middleware, routes — exports `app` (no `listen()`)
│   │   ├── server.ts         Entry point — calls `app.listen()` and runs migrations
│   │   ├── config/db.ts      pg pool + query helper
│   │   ├── controllers/      authController, sessionController, profileController, intentionController
│   │   ├── middleware/       authMiddleware (JWT verification)
│   │   ├── migrations/       001–005 numbered SQL files (run manually in Supabase SQL Editor)
│   │   ├── models/           userModel, sessionModel, profileModel, intentionModel, passwordResetModel
│   │   ├── routes/           authRoutes, sessionRoutes, profileRoutes, intentionRoutes
│   │   └── services/         emailService (password reset emails)
│   └── docs/
│       ├── database.md       Schema reference
│       └── api.md            Endpoint reference
└── frontend_app/             React SPA (Vite dev server, port 3000)
    ├── src/
    │   ├── app/              HomePage, ResetPasswordPage, PathAheadPage, CalendarPage,
    │   │                     AnalyticsPage, IntentionsPage, JournalEntryPage, ProfilePage
    │   ├── components/       AppShell, BeltBar, TrainingHeatmap, CompactHeatmap,
    │   │                     HeatmapPreviewWidget, SkillRadar, TimeRangeBar,
    │   │                     LogSessionForm, SessionDetailModal, SetIntentionModal,
    │   │                     CsvImportModal, PageTransition, OfflineBanner,
    │   │                     WaveBackground, ErrorBoundary
    │   ├── context/          AuthContext (JWT in localStorage), ProfileContext
    │   ├── hooks/            useAuth, useCountUp, useOnlineRefetch, useOnlineSync, usePendingSessions, use-toast
    │   ├── types/            api.ts (shared API response types)
    │   └── lib/              api.ts, offlineQueue.ts, apiCache.ts, pendingSessions.ts,
    │                         belt.ts, constants.ts, theme.ts, utils.ts, csvParser.ts
    └── docs/
        └── components.md     Component catalog
```

---

## Quickstart (local dev)

### Git hooks (one-time setup after cloning)

```bash
npm install   # at repo root — installs husky and activates the pre-commit hook
```

The pre-commit hook runs `npm test` in `backend_api/` before every commit. Bypass with `git commit --no-verify` for WIP commits.

### Backend

```bash
cd backend_api
npm install
# Create .env with at minimum:
#   DATABASE_URL=<your Supabase connection string>
#   JWT_SECRET=<long random string>
# Optional email (falls back to Ethereal test account if omitted):
#   SMTP_HOST=  SMTP_PORT=587  SMTP_USER=  SMTP_PASS=
#   SMTP_FROM=Journada <noreply@yourapp.com>
#   FRONTEND_URL=http://localhost:3000
npm run dev        # tsx watch mode on port 5000
```

The server validates required env vars on startup and exits with a clear message if any are missing. The `password_reset_tokens` table is created automatically on first startup via `CREATE TABLE IF NOT EXISTS`.

### Frontend

```bash
cd frontend_app
npm install
# Optional .env:
#   VITE_GOOGLE_MAPS_API_KEY=<key>   for gym address autocomplete
npm run dev        # Vite dev server on port 3000
```

Vite proxies `/auth` and `/api` to `http://localhost:5000` in dev — no CORS configuration needed locally.

---

## Railway Deployment

The app runs as two separate Railway services.

### Required environment variables

**Backend service**

| Variable | Notes |
|---|---|
| `DATABASE_URL` | Supabase / Postgres connection string |
| `JWT_SECRET` | Long random string — never share this |
| `ALLOWED_ORIGIN` | `https://your-frontend.railway.app` |
| `SMTP_HOST` | Optional — Ethereal test account used if absent |
| `SMTP_PORT` | `587` |
| `SMTP_USER` | Optional |
| `SMTP_PASS` | Optional |
| `SMTP_FROM` | e.g. `Journada <noreply@yourapp.com>` |
| `FRONTEND_URL` | `https://extraordinary-freedom-production.up.railway.app/` (used in reset links) |

**Frontend service**

| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | `https://j2-production.up.railway.app/` — **required**, must be set before build |
| `VITE_GOOGLE_MAPS_API_KEY` | Optional — enables gym address autocomplete |

> `VITE_API_BASE_URL` is a build-time variable. Set it in Railway, then trigger a redeploy so Vite bakes it into the bundle.

### Health check

`GET https://j2-production.up.railway.app/` returns:
```json
{ "status": "ok", "db": "connected" }
```

---

## Authentication Flow

1. User registers or logs in via `POST /auth/register` or `POST /auth/login`
2. Backend returns a signed JWT (24h expiration)
3. Frontend stores token in `localStorage` via `AuthContext.login()`
4. All subsequent requests include `Authorization: Bearer <token>`
5. `authMiddleware` verifies the token and attaches `{ id, email }` to `req.user`
6. On 401, the global handler in `api.ts` auto-logs out and redirects to `/`

### Password Reset Flow

1. User submits email on the "Forgot password" screen → `POST /auth/request-password-reset`
2. Backend generates a 32-byte random token, stores its **SHA-256 hash** in `password_reset_tokens` (1h expiry), sends email with the raw token
3. Email contains `FRONTEND_URL/reset-password?token=<token>`
4. User clicks link → `ResetPasswordPage` reads token from URL query param
5. User submits new password → `POST /auth/reset-password`
6. Backend validates token (not expired, not used), updates `password_hash`, marks token used

In dev without SMTP configured: the reset email preview URL is logged to the backend console (Ethereal).

---

## Data Model (summary)

See [`backend_api/docs/database.md`](backend_api/docs/database.md) for full schema.

| Table | Purpose |
|---|---|
| `users` | Identity, auth credentials, profile data, and feature flags |
| `training_sessions` | One row per session; includes a `tags` text array for skill tracking |
| `password_reset_tokens` | Short-lived tokens for the password reset flow |
| `weekly_intentions` | Weekly training intentions with optional journal entries |

---

## Visual Design System

All color tokens live in `frontend_app/src/lib/theme.ts`. Never hard-code colours in components.

| Token | Value | Used for |
|---|---|---|
| `PAGE_BG` / `SURFACE_0` | `#0D1A14` | App background |
| `CARD_BG` / `SURFACE_1` | `#152E22` | Primary raised card surface |
| `SURFACE_2` | `rgba(255,255,255,0.035)` | Sub-section within a card |
| `SURFACE_3` | `rgba(255,255,255,0.08)` | Interactive element resting state |
| `PALE_YELLOW` | `#F2E4A8` | Titles, active nav labels, champagne gold |
| `COPPER` | `#C4915F` | Borders, rail accents |
| `COPPER_BORDER` | `rgba(196,145,95,0.45)` | Standard card border |
| `CARD_SHADOW` | 4-layer composite | Card drop shadow with chromatic depth |
| `GLOW_TITLE` | text-shadow | Hero title glow |
| `GLOW_SOFT` | text-shadow | Stat numbers and section headings |
| `GLOW_NAV` | text-shadow | Nav links and buttons |
| `HEATMAP_REST` | `#0A1610` | Rest / empty heatmap cell |

Tailwind brand tokens (in `tailwind.config.ts`): `brand.orange` `#DA7422`, `brand.green` `#6FD08C`, `brand.light-green` `#CDDFA0`, `brand.dark` `#0D1A14`.

---

## Key Features

### The Path Ahead (`PathAheadPage.tsx`)
The main home view. Composed of:
- **Intention banner** — shows the active weekly intention with animated particles, purple glow, and delete button
- **View toggle** — switch between carousel and list display of the current week's sessions
- **Day card stack** — swipeable deck of 7 day cards showing sessions per day. Swipe left/right (or tap the day indicator) to navigate. Cards use a z-axis absolute stack with velocity-based threshold and RAF-throttled drag for a natural flick feel. Active card pivots near the bottom edge (`transformOrigin: 50% 85%`) to match thumb position.
- **Day-initial indicator** — tap any letter below the deck to jump directly to that day
- **Weekly summary** — session count, total duration, Training Telemetry (top skill tag prose sentence)
- **Rep Roulette** — spin to get a random BJJ drill with rep suggestion

### Training Heatmap (`TrainingHeatmap.tsx`)
Year-at-a-glance calendar grid. Cells coloured by max session intensity for that day. Click any cell to view or edit the session.

| Intensity | Colour |
|---|---|
| Rest / no session | dark (`HEATMAP_REST` `#0A1610`) |
| Easy (1–2) | light green (`#CDDFA0`) |
| Moderate (3) | green (`#6FD08C`) |
| Hard (4) | amber (`#D4A040`) |
| Max (5) | orange (`#DA7422`) |

### Analytics Instrument (`SkillRadar.tsx`)
Five views switched via a vertical icon rail. All views share the same card dimensions; content slides in/out with a spring animation.

| View | Chart | Description |
|---|---|---|
| **Grappling Prism** | Pentagon radar | Hours across 5 skill pillars |
| **Volume by Month** | Bar chart | Monthly hours + peak/avg stats |
| **The Two Worlds** | Stacked bar | Gi vs No-Gi split |
| **Session Format** | Stacked bar | Class / Drilling / Competition |
| **Weekly Rhythm** | Bar chart | Hours per week across 52 weeks |

- **Time windows**: 7D · 14D · 30D · 90D · 180D · 1Y · Custom date range
- **Display toggle** (h / %): hidden on Volume and Weekly Rhythm views (where percentages don't apply); morphs into a thin line for those views
- **View transition**: exit fast-start 500ms, enter spring 560ms + 120ms delay — no overlap

### Weekly Intentions
Set a short focus label (max 20 chars) and category (technical / physical / mental / positional / competitive) for any week. Active intentions display a glowing animated banner on the home screen and overlay each day card. Intentions have duration (preset options: 3, 5, 7, or 14 days). Each intention can have a journal entry written via the Journal Entry page (autosaves on 1.5s debounce).

### CSV Import (`CsvImportModal.tsx`)
Import historical training data from a spreadsheet CSV. Client-side parsing with PapaParse, row-by-row review with flagging of duplicates and validation errors, then atomic batch insert via `POST /api/sessions/import` (max 500 rows, transactional).

### Belt Bar (`BeltBar.tsx`)
Animated BJJ belt tying sequence on load. Belt, knot, and tails animate in sequence. Tails become draggable/whippable post-animation (easter egg).

### Log Session Form (`LogSessionForm.tsx`)
Modal for logging a session: date, duration (preset buttons + custom), type (Class / Drilling / Competition), Gi / No-Gi, intensity 1–5, skill tags (multi-select, at least 1 required), notes. Accepts optional `defaultDate` prop so tapping an empty day card pre-fills the date.
