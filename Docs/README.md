# Journada — Documentation Index

**Journada** is a BJJ / martial arts training tracker. It helps practitioners log sessions, set weekly intentions, analyse skill trends, and track belt progression. The primary target platform is **mobile and tablet**, with desktop as a secondary surface.

---

## Current Status

| Layer | Status |
|---|---|
| Backend API | Live — 16 endpoints across auth, sessions, profile, intentions |
| Database | PostgreSQL on Supabase — 4 tables, 7 migrations applied + auto-migration on startup |
| Frontend | Live — 8 active pages, full navigation, flagship UI design system |
| PWA / Offline | Installable PWA with service worker (Workbox via vite-plugin-pwa), offline write queue (IndexedDB), auto-sync on reconnect |
| Mobile layout | Complete — all pages have dedicated mobile layouts with touch-optimized controls |
| Desktop layout | Complete — all pages use `useIsDesktop` hook (1024px) for wider layouts, 2-column grids where appropriate |
| Design system | Unified `SegmentedToggle`, SURFACE_2 section cards, intensity color bar, spring physics, haptic feedback, no-emoji policy |
| Tests | Backend Vitest suite (auth, sessions, JWT middleware); Frontend component tests (Vitest + RTL); E2E Playwright suite — auth + visual overview + 6 behavioral usage flows (log session, set intention, open journal entry, scroll calendar, open session from calendar) across 3 viewports. Pre-commit hook configured but currently failing. |

---

## What's Built

### Auth
- Register / login with JWT (24h expiry)
- Password reset via email token (1-hour expiry, Resend SMTP)
- Rate limiting on auth routes (10 req / 15 min per IP)
- Auto-logout on 401, token persisted in localStorage

### Session Logging
- **Flagship LogSessionForm** — 3-section card layout (The Basics → Your Focus → Details) with unified SegmentedToggle controls, intensity color-gradient bar, duration preset pills + stepper, PillarPrism for heading selection, sub-skill tag chip suggestions, haptic feedback
- **Dynamic Pillar Engine** — heading (pillar focus), polarity (offense/defense/neutral), sub-skill tag, script source (coach-led/open mat), resonance (distance-from-vertex alignment score)
- **SessionDetailModal** — VIEW panel with SURFACE_2 cards (Stats, Focus, Journal) + intensity bar. EDIT panel mirrors LogSessionForm design with SegmentedToggle, PillarPrism, all Pillar Engine fields
- **Multiple sessions per day** fully supported — week view aggregates duration, shows ×N count badge, and provides ← / → navigator in detail modal
- **Bulk CSV import** — upload up to 500 sessions at once via `CsvImportModal` (transactional batch insert)

### Day Carousel (Path Ahead — `/home`)
- Fixed 11-day carousel centred on today (today ± 5 days)
- DayCard per day: total duration, intensity dot (highest intensity session), type/style/tags from primary session, ×N badge when multiple sessions
- **Week view toggle** — switch between minimalist carousel (horizontal scroll) and detail list view (vertical session cards with type dot, title, meta, duration). Persisted to localStorage.
- Weekly intention banner across all days with particle effects and intention brightness gradient
- Weekly Summary card: total sessions + duration, Ambient Focus (most-trained skill tag)
- `+ Mat Time` quick-log button on today when no session exists

### Intentions (`/intentions`)
- **SetIntentionModal** — PillarPrism in snap-only mode for heading selection, optional label (max 20 chars), SegmentedToggle for duration (3d/5d/7d/14d), journal toggle
- One intention per week per user (enforced at DB level)
- Journal entry per intention with 1.5s autosave (SURFACE_2 card, flagship Save button)
- **Intentions history** — SURFACE_2 cards with week date, duration badge, heading + label, alignment indicator (colored bar + "Aligned"/"Diverged" text), journal snippet. 2-column grid on desktop.
- Can be toggled on/off via Profile → Features

### Calendar (`/calendar`)
- Full-year heatmap grid (Mon–Sun per row) in detailed view
- Cell colour by intensity: Rest → Easy → Moderate → High
- Intention periods overlaid on relevant weeks
- Click any day to open SessionDetailModal
- **Compact view toggle** — GitHub contribution-graph style. Persisted to localStorage.
  - **Mobile:** CompactHeatmap (18px cells, horizontal scroll, auto-scrolls to today)
  - **Desktop:** CalendarHeatmap (52-week rolling year, 16px cells, day labels Mon/Wed/Fri, month labels, clickable cells → log session, hover scale, stats summary row with sessions/hours/streak/top focus)

### Analytics (`/analytics`)
- SkillRadar with 4 views: Grappling Prism (radar pentagon), Volume by Month, Gi vs No-Gi (donut), Session Format (donut)
- Time window filter: 30d / 60d / 90d / All Time
- Collapsible Intention vs Ambient Focus table — per-intention row with stated goal vs most-trained skill

### Profile (`/profile`)
- Name, belt rank (White → Black), stripes (0–4)
- Home gym with Google Places autocomplete (degrades to plain text if no API key)
- Intentions feature toggle (stored per user in DB)

### PWA / Offline
- **Installable** — web manifest (`manifest.webmanifest`) with app icons, standalone display mode
- **Service worker** — generated by `vite-plugin-pwa` (Workbox), precaches app shell (JS/CSS/HTML), runtime caches Google Fonts and API GET responses (NetworkFirst, 5s timeout, 24h fallback)
- **Offline write queue** — failed POST/PUT/PATCH/DELETE requests are stored in IndexedDB (`offlineQueue.ts`) and automatically replayed when connectivity returns
- **Offline UI** — amber "You're offline" banner with pending queue count, green "Back online" flash on reconnect, toast notifications for sync progress
- **Session logging offline** — LogSessionForm succeeds optimistically when offline, shows "Session saved offline — will sync when connected"

---

## Project Structure

```
Journada P2/
├── Docs/
│   ├── README.md               ← this file
│   ├── Implementations.md      ← third-party library integrations (D3, etc.)
│   ├── api.md                  ← all HTTP endpoints
│   ├── architecture.md         ← tech stack, system diagram, env vars
│   ├── backend.md              ← controller, model, middleware reference
│   ├── database.md             ← schema, migrations, model functions
│   ├── feature-list.md         ← implemented vs planned
│   ├── frontend.md             ← pages and components reference
│   ├── mobile.md               ← mobile layout audit and strategy
│   ├── screenshots.md          ← dated app screenshots (desktop + mobile)
│   ├── screenshots/            ← screenshot image files by date
│   └── testing.md              ← testing guide (backend, frontend, e2e)
└── project/J2/
    ├── backend_api/
    │   ├── src/
    │   │   ├── app.ts
    │   │   ├── config/db.ts
    │   │   ├── controllers/
    │   │   ├── middleware/
    │   │   ├── models/
    │   │   └── routes/
    │   └── migrations/
    └── frontend_app/
        └── src/
            ├── app/           ← 9 page components
            ├── components/    ← shared UI + modals
            ├── context/       ← AuthContext, ProfileContext
            ├── hooks/         ← useAuth, useCountUp, use-toast, useOnlineSync, useIsDesktop
            └── lib/           ← api client, offlineQueue, theme, belt, constants, haptics, spring, csvParser, utils
```

---

## Quick Start

### Backend
```bash
cd "project/J2/backend_api"
npm install
# create .env with DATABASE_URL, JWT_SECRET, PORT
npm run dev        # tsx watch — live reload
npm run build      # tsc → dist/
npm start          # node dist/server.js
```

### Frontend
```bash
cd "project/J2/frontend_app"
npm install
# optionally add VITE_GOOGLE_MAPS_API_KEY to .env for gym autocomplete
npm run dev
```

---

## Docs Index

| File | Contents |
|---|---|
| [Implementations.md](Implementations.md) | Third-party library integrations — D3.js setup, patterns, and planned usage |
| [analytics-math.md](analytics-math.md) | Deep dive into every analytical model — formulas, worked examples, design decisions |
| [api.md](api.md) | All HTTP endpoints — method, path, auth, validation, responses |
| [architecture.md](architecture.md) | Tech stack, system diagram, environment variables |
| [backend.md](backend.md) | Controller, model, middleware, and route reference |
| [beliefs.md](beliefs.md) | The six structurally necessary buyer beliefs — inevitability chain for messaging |
| [customer-archetype.md](customer-archetype.md) | Customer avatar sheet — demographics, pain points, goals, emotional journey, representative quotes |
| [customer-research.md](customer-research.md) | Primary-source customer research — buyer profile, language patterns, copy ammunition, positioning recommendations |
| [product-offer.md](product-offer.md) | Strategic messaging & offer architecture — positioning, big idea, UMP/UMS, headlines, objections, funnel, domains |
| [database.md](database.md) | Full schema, migrations, model functions |
| [feature-list.md](feature-list.md) | Implemented vs planned features |
| [frontend.md](frontend.md) | All pages and components with props and behaviour |
| [mobile.md](mobile.md) | Mobile layout audit, priorities, and strategy |
| [onboarding.md](onboarding.md) | Onboarding flow design — research, step-by-step flow, data collection, UI specs |
| [onboarding-plan.md](onboarding-plan.md) | Onboarding implementation plan — phased work breakdown, file changes, dependencies |
| [roadmap.md](roadmap.md) | Upcoming sprints and backlog |
| [screenshots.md](screenshots.md) | Dated app screenshots (desktop + mobile) |
| [testing.md](testing.md) | Testing guide: backend, frontend, and e2e test suites |
