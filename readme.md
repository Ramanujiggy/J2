# Journada P2

A full-stack martial arts training tracker for BJJ athletes. Log sessions, visualize skill development across five pillars, and track volume trends over time.

---

## Stack

| Layer | Tech |
|---|---|
| Backend | Node.js + Express 5 + TypeScript |
| Database | PostgreSQL on Supabase (via `pg` pool) |
| Auth | JWT (24h) + bcrypt (12 rounds) |
| Frontend | React 18 + Vite + Tailwind CSS |
| UI primitives | Radix UI + shadcn/ui |

---

## Project Structure

```
project/J2/
├── backend_api/          Node.js API server (port 5000)
│   ├── src/
│   │   ├── app.ts        Entry point — Express setup, routes mounted
│   │   ├── config/db.ts  pg pool + query helper
│   │   ├── controllers/  authController, sessionController, profileController
│   │   ├── middleware/   authMiddleware (JWT verification)
│   │   ├── models/       userModel, sessionModel, profileModel
│   │   └── routes/       authRoutes, sessionRoutes, profileRoutes
│   └── docs/
│       ├── database.md   Schema reference
│       └── api.md        Endpoint reference
└── frontend_app/         React SPA (Vite dev server)
    ├── src/
    │   ├── app/          DashboardPage, HomePage, ProfilePage
    │   ├── components/   BeltBar, TrainingHeatmap, SkillRadar, LogSessionForm, …
    │   ├── context/      AuthContext (JWT in localStorage)
    │   ├── hooks/        useAuth, use-toast
    │   └── lib/          api.ts, constants.ts, theme.ts, utils.ts
    └── docs/
        └── components.md Component catalog
```

---

## Quickstart

### Backend

```bash
cd backend_api
npm install
# Copy .env and fill in DATABASE_URL and JWT_SECRET
npm run dev        # tsx watch mode on port 5000
```

### Frontend

```bash
cd frontend_app
npm install
# Optional: set VITE_GOOGLE_MAPS_API_KEY in .env for gym autocomplete
npm run dev        # Vite dev server
```

---

## Authentication Flow

1. User registers or logs in via `POST /auth/register` or `POST /auth/login`
2. Backend returns a signed JWT (24h expiration)
3. Frontend stores token in `localStorage` via `AuthContext.login()`
4. All subsequent requests include `Authorization: Bearer <token>`
5. `authMiddleware` verifies the token and attaches `{ id, email }` to `req.user`
6. On 401, the global handler in `api.ts` auto-logs out and redirects to `/`

---

## Data Model (summary)

See [`backend_api/docs/database.md`](backend_api/docs/database.md) for full schema.

**users** — identity + profile (name, belt rank, stripes, home gym)
**training_sessions** — one row per session; includes a `tags` text array for skill tracking

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

- SQL migration to add the `tags` column (run once in Supabase SQL Editor):
  ```sql
  ALTER TABLE training_sessions ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}';
  ```
