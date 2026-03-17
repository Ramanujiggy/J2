# Journada

A full-stack martial arts training tracker for BJJ athletes. Log sessions, visualize skill development across five pillars, track volume trends over time, and set weekly intentions.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express 5 + TypeScript |
| Database | PostgreSQL on Supabase (via `pg` pool) |
| Auth | JWT (24h) + bcrypt (12 rounds) |
| Email | Nodemailer — Ethereal in dev, SMTP in production |
| Frontend | React 18 + Vite + Tailwind CSS |
| UI primitives | Radix UI + shadcn/ui |
| Hosting | Railway (separate frontend + backend services) |

---

## Project Structure

```
J2/
├── backend_api/              Node.js API server (port 5000)
│   ├── src/
│   │   ├── app.ts            Entry point — env validation, migrations, Express setup, routes
│   │   ├── config/db.ts      pg pool + query helper
│   │   ├── controllers/      authController, sessionController, profileController, intentionController
│   │   ├── middleware/       authMiddleware (JWT verification)
│   │   ├── migrations/       add_password_reset_tokens.sql (auto-run on startup)
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
    │   ├── components/       BeltBar, TrainingHeatmap, SkillRadar, LogSessionForm, …
    │   ├── context/          AuthContext (JWT in localStorage), ProfileContext
    │   ├── hooks/            useAuth, use-toast
    │   └── lib/              api.ts, constants.ts, theme.ts, utils.ts
    └── docs/
        └── components.md     Component catalog
```

---

## Quickstart (local dev)

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

The server validates required env vars on startup and exits with a clear message if any are missing. The `password_reset_tokens` table is created automatically on first startup.

### Frontend

```bash
cd frontend_app
npm install
# Optional .env:
#   VITE_GOOGLE_MAPS_API_KEY=<key>   for gym address autocomplete
npm run dev        # Vite dev server on port 3000
```

Vite proxies `/auth` and `/api` to `http://localhost:5000` in dev — no CORS configuration needed.

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
| `FRONTEND_URL` | `https://your-frontend.railway.app` (used in reset links) |

**Frontend service**

| Variable | Notes |
|---|---|
| `VITE_API_BASE_URL` | `https://your-backend.railway.app` — **required**, must be set before build |

> `VITE_API_BASE_URL` is a build-time variable. Set it in Railway, then trigger a redeploy so Vite bakes it into the bundle.

### Health check

`GET https://your-backend.railway.app/` returns:
```json
{ "status": "ok", "db": "connected" }
```
Use this to confirm the backend is alive and connected to the database after a deploy.

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
2. Backend generates a 32-byte random token, stores it in `password_reset_tokens` (1h expiry), sends email
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
| `users` | Identity, auth credentials, and profile data |
| `training_sessions` | One row per session; includes a `tags` text array for skill tracking |
| `password_reset_tokens` | Short-lived tokens for the password reset flow |
| `intentions` | Weekly training intentions with optional journal entries |

---

## Visual Design System

All color tokens live in `frontend_app/src/lib/theme.ts`. Never hard-code colours in components.

| Token | Value | Used for |
|---|---|---|
| `PAGE_BG` | `#111e2b` | App background |
| `CARD_BG` | `#1a2f40` | Card surfaces |
| `PALE_YELLOW` | `#F0DFA0` | Titles, active labels |
| `COPPER` | `#B87A55` | Borders, rail accents |
| `COPPER_BORDER` | rgba variant | Card borders |
| `GLOW_SOFT` | text-shadow | Secondary glow on active elements |
| `GLOW_TITLE` | text-shadow | Hero title glow |

---

## Key Features

### Training Heatmap (`TrainingHeatmap.tsx`)
Year-at-a-glance calendar grid. Cells coloured by max session intensity for that day. Click any cell to view or edit the session.

| Intensity | Colour |
|---|---|
| Rest / no session | dark (`HEATMAP_REST`) |
| Easy (1–2) | light green (`#CDDFA0`) |
| Moderate (3) | green (`#6FD08C`) |
| High (4–5) | orange (`#DA7422`) |

### Analytics Instrument (`SkillRadar.tsx`)
Four views switched via a vertical icon rail. All views share the same card dimensions; content slides in/out with a spring animation.

| View | Chart | Description |
|---|---|---|
| **Grappling Prism** | Pentagon radar | Hours across 5 skill pillars |
| **Volume by Month** | Bar chart | Monthly hours + peak/avg stats |
| **The Two Worlds** | Donut | Gi vs No-Gi split |
| **Session Format** | Donut | Class / Drilling / Competition |

- **Time windows**: 30 Days · 60 Days · 90 Days · All Time
- **Display toggle** (h / %): stationary in header, not part of view transitions. On Volume view (where it doesn't apply) it morphs into a horizontal line and slides into the rail border, then reverses on exit.
- **View transition**: exit slides out immediately with fast-start easing (500ms), enter follows with a 120ms delay and spring bounce (560ms) — no visual overlap.

### Belt Bar (`BeltBar.tsx`)
Animated BJJ belt tying sequence on load. Belt, knot, and tails animate in sequence. Tails become draggable/whippable post-animation (easter egg).

### Log Session Form (`LogSessionForm.tsx`)
Modal for logging a session: date, duration (presets + custom fields), type (Class / Drilling / Competition), Gi / No-Gi, intensity 1–5, notes, multi-select skill tags.

---

## Pending

- Run the tags column migration once in Supabase SQL Editor if not already applied:
  ```sql
  ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
  ```
