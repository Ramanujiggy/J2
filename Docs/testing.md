# Journada — Testing Guide

Journada uses three testing tiers. Each tier has its own framework, scope, and run command.

| Tier | Framework | Scope | Location | Command |
|------|-----------|-------|----------|---------|
| Backend unit / integration | Vitest + Supertest | API endpoints, middleware, auth | `backend_api/tests/` | `cd backend_api && npm test` |
| Frontend component | Vitest + React Testing Library | Pages, components, user interactions | `frontend_app/src/**/__tests__/` | `cd frontend_app && npm run test:run` |
| End-to-end | Playwright | Full-stack browser flows | `e2e/` | `npm run e2e` (from project root) |

---

## Backend Tests — Vitest + Supertest

### Config

- **Framework**: Vitest 4.x (node environment)
- **HTTP testing**: Supertest 7.x (drives Express app without starting the server)
- **Config file**: `backend_api/vitest.config.ts`
- **Environment**: Node — test env vars set in config (`DATABASE_URL`, `JWT_SECRET`, `NODE_ENV`)

### Test Files

| File | Covers |
|------|--------|
| `tests/auth.test.ts` | Register, login, request-password-reset, reset-password |
| `tests/sessions.test.ts` | Log session, get sessions (with date filters), bulk CSV import, update, delete |
| `tests/middleware.test.ts` | `verifyToken` JWT middleware — missing token, invalid token, valid token |

### Mock Strategy

- `vi.mock('../src/config/db.js')` — prevents real database connections
- Model functions (e.g. `findUserByEmail`, `createUser`) mocked individually via `vi.mocked()`
- `bcrypt` mocked with deterministic hash output
- Test JWT secret set in `vitest.config.ts` env block

### Commands

```bash
cd backend_api
npm test            # single run (vitest run)
npm run test:watch  # watch mode
npm run coverage    # V8 coverage report
```

### Status

Tests are currently **failing** — fixture/mock setup is incomplete. The Husky pre-commit hook (`cd backend_api && npm test`) is affected.

---

## Frontend Tests — Vitest + React Testing Library

### Config

- **Framework**: Vitest 2.x
- **DOM environment**: happy-dom (lightweight, fast)
- **UI testing**: @testing-library/react + @testing-library/user-event
- **Assertions**: @testing-library/jest-dom (custom matchers like `toBeVisible()`)
- **Config file**: `frontend_app/vitest.config.ts`
- **Setup file**: `frontend_app/src/setupTests.ts` (imports jest-dom matchers)
- **Path alias**: `@/` → `./src/` (matches Vite config)

### Test Files

| File | Covers |
|------|--------|
| `src/app/__tests__/HomePage.test.tsx` | Login, register, password reset flows, form validation |
| `src/app/__tests__/PathAheadPage.swipe.test.tsx` | Touch swipe gestures on the day carousel |
| `src/components/__tests__/LogSessionForm.test.tsx` | Form validation, API submission, loading states, offline response handling |

### Mock Strategy

- `@/lib/api` — mocked to prevent real fetch calls
- `@/hooks/useAuth` — mocked to control auth state (token, login/logout)
- `react-router-dom` (partial) — `useNavigate` mocked, `MemoryRouter` used for rendering
- Heavy components (`SessionDetailModal`, `SetIntentionModal`) stubbed to keep tests focused
- `offlineQueue.ts` — can be unit tested with `fake-indexeddb` (not yet added)
- `vi.useFakeTimers()` for date-dependent tests (e.g. fixing "today" to a known date)
- `localStorage` mocked and cleared between tests

### Commands

```bash
cd frontend_app
npm test            # watch mode (default)
npm run test:run    # single run
npm run test:coverage   # V8 coverage report
```

---

## E2E Tests — Playwright

### Config

- **Framework**: @playwright/test (installed at project root `J2/`)
- **Config file**: `playwright.config.ts`
- **Test directory**: `e2e/`
- **Browser**: Chromium (downloaded via `npx playwright install chromium`)

### Viewports

Three projects run every test across desktop and mobile:

| Project | Device | Viewport | Purpose |
|---------|--------|----------|---------|
| `desktop-chrome` | Desktop Chrome | 1280×720 | Standard desktop |
| `mobile-chrome` | Pixel 7 | 393×851 | Android mobile |
| `mobile-safari` | iPhone 14 | 390×844 | iOS mobile (WebKit) |

### Test Files

| File | Covers |
|------|--------|
| `e2e/auth.spec.ts` | Landing page load, email validation, login/register toggle, forgot password flow |
| `e2e/usage.spec.ts` | **Behavioral usage flows** — self-seeds a fresh account, then logs a session, sets an intention, opens a journal entry, scrolls the calendar, and opens a session from the calendar. Runs across all 3 viewports. |
| `e2e/interaction.spec.ts` | Mobile-only tap/interaction guard tests — catches the `PageContent` "fading" state regression where `pointer-events: none` silently kills all descendants |
| `e2e/form-audit.spec.ts` | Screenshot audit of the LogSessionForm layout — renders every section state across viewports (defaults to Railway prod) |
| `e2e/intentions-audit.spec.ts` | Screenshot audit of the Intentions page empty-state and modal (defaults to Railway prod) |
| `e2e/session-detail-audit.spec.ts` | Screenshot audit of the SessionDetailModal open/edit states (defaults to Railway prod) |
| `e2e/visual-overview.spec.ts` | Full visual snapshot suite — registers a test account, screenshots every page (Home, Calendar, Analytics, Profile, Intentions) across all 3 viewports |

### Usage Flows Suite (`usage.spec.ts`)

The newest E2E suite exercises the six core flows a real user runs through. Uses a **self-seeding** pattern so every run is deterministic from a fresh DB state:

| # | Test | What it does |
|---|------|--------------|
| 00 | seed | Registers a fresh `usage-{timestamp}@journada-e2e.com` account and logs the first session so subsequent tests have content to work with |
| 01 | log a session | Re-opens the LogSessionForm, fills duration + pillar, submits, verifies `POST /api/sessions` returns 2xx |
| 02 | set an intention | Opens the intention modal from the Path Ahead home CTA, selects a Prism vertex, saves, verifies the active-intention card shows the new pillar |
| 03 | open a journal entry | Desktop: clicks a row on `/journal`, asserts `/journal/:id`. Mobile: flips the week view to list mode and taps a session-bearing DayCard |
| 04 | scroll the calendar | Navigates to the calendar surface (Atlas → Calendar on desktop, `/calendar` on mobile) and walks the year nav forward/back |
| 05 | open session from calendar | Taps a heatmap day cell populated with a session and asserts the SessionDetailModal opens |

**Helpers** (in `usage.spec.ts`):
- `isDesktopViewport(page)` — viewport-aware branching
- `goTo(page, dest)` — navigates via rail buttons on desktop, URL paths / bottom tabs on mobile; routes "calendar" through Atlas → Calendar sub-tab on desktop
- `openLogSessionForm(page)` — tries multiple CTAs in priority order (First-Visit "Log Your First Session", PathAhead "+ Mat Time", desktop "+ Log session" header button, mobile FAB `aria-label="Log a training session"`)
- `fillAndSaveSession(page)` — picks "1 h" duration, selects the guard pillar, submits, and blocks on the POST response so silent validation failures surface as test failures
- `selectPillar(page, pillar, { scope? })` — computes pentagon vertex coords from the PillarPrism SVG's bounding box and dispatches a locator click at that position (the Prism is an SVG pointer-event canvas, not button-based)

**Running the suite:**

Run per-project — parallel across viewports flakes due to shared-backend contention on the Supabase pool:

```bash
npm run e2e -- --project=desktop-chrome --grep "Usage flows"
npm run e2e -- --project=mobile-chrome  --grep "Usage flows"
npm run e2e -- --project=mobile-safari  --grep "Usage flows"
```

To run against production instead of local dev:

```bash
E2E_BASE_URL=https://extraordinary-freedom-production.up.railway.app \
  npm run e2e -- --project=desktop-chrome --grep "Usage flows"
```

**Known parallel flakiness:** `npm run e2e --grep "Usage flows"` (all 3 projects at once) hits the shared Supabase backend from three workers simultaneously and intermittently fails test 01 on session POST timeout. Each project passes 6/6 reliably when run alone. If you must run parallel, add `--retries=2` or `--workers=1`.

### Test-Supporting Attributes

Some UI attributes exist **specifically to keep the E2E suite deterministic** — don't strip them in refactors:

| Attribute | Location | Purpose |
|-----------|----------|---------|
| `data-testid="pillar-prism"` | `frontend_app/src/components/PillarPrism.tsx` (on the `<svg>`) | `selectPillar` uses this to compute vertex click coordinates |
| `data-testid="week-list"` | `frontend_app/src/app/PathAheadPage.tsx` | Test 03 (mobile) scopes DayCard clicks to the list-view section |
| `aria-label="Log a training session"` | `frontend_app/src/components/AppShell.tsx` (mobile FAB) | Fallback entry point for `openLogSessionForm` |
| `aria-label="Previous year"` / `"Next year"` | `frontend_app/src/app/CalendarPage.tsx` year nav | Test 04 year navigation on mobile (already present on desktop Atlas CalendarPanel) |
| `aria-label="Close"` | `SessionDetailModal` × button | Test 03/05 modal-opened assertion |
| `aria-label="List view"` | `PathAheadPage.tsx` week view toggle | Test 03 (mobile) flips to list view to access DayCards |

### Dev Server Auto-Start

The Playwright config includes `webServer` entries that automatically start:
- Backend on port 5000 (`cd backend_api && npm run dev`)
- Frontend on port 4173 (`cd frontend_app && npm run dev -- --port 4173`)

If these servers are already running, they are reused (`reuseExistingServer: true` in non-CI environments).

### Commands

Run all from the project root (`project/J2/`):

```bash
npm run e2e           # headless run (all 3 viewports)
npm run e2e:ui        # interactive UI mode (debug visually)
npm run e2e:headed    # run with visible browser window
npm run e2e:report    # open the last HTML report
```

### Testing Against a Deployed Site

Set `E2E_BASE_URL` to skip local servers and test the live deployment:

```bash
E2E_BASE_URL=https://extraordinary-freedom-production.up.railway.app npm run e2e
```

### Artifacts

- **Test results**: `e2e/test-results/` (screenshots on failure, traces on retry)
- **Visual snapshots**: `e2e/screenshots/` (full-page PNGs per viewport, generated by `visual-overview.spec.ts`)
- **HTML report**: `e2e/playwright-report/` — open with `npm run e2e:report`
- All three directories are git-ignored.

---

## Coverage

| Tier | Command | Provider |
|------|---------|----------|
| Backend | `cd backend_api && npm run coverage` | V8 |
| Frontend | `cd frontend_app && npm run test:coverage` | V8 |
| E2E | `npm run e2e:report` | HTML report (pass/fail per viewport) |

---

## Test File Conventions

| Tier | Pattern | Location |
|------|---------|----------|
| Backend | `<domain>.test.ts` | `backend_api/tests/` |
| Frontend pages | `<PageName>.test.tsx` | `frontend_app/src/app/__tests__/` |
| Frontend components | `<Component>.test.tsx` | `frontend_app/src/components/__tests__/` |
| E2E | `<feature>.spec.ts` | `e2e/` |

---

## Pre-Commit Hook

Husky runs before every commit:

```bash
cd backend_api && npm test
```

This currently **fails** because the backend test fixtures are incomplete. Commits can bypass with `--no-verify` but the tests should be fixed before the next release.
