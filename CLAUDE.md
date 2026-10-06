# Journada — Agent Context

Read this before touching anything. It encodes decisions that aren't obvious from the code.

---

## What This Is

Journada is a BJJ training journal. Not a tracker, not an analytics dashboard — a **journal**. The goal is to be the easiest possible way for a practitioner to keep an honest record of their training: the sessions, the techniques they're working, the psychological and emotional texture of the journey.

The insight behind the product: every other BJJ app has retention problems because logging is friction. Journada's bet is that if the experience of recording is dignified and effortless, people will actually keep the record — and once the record exists, you can add value through data and AI on top of it. The journal is the moat.

The product has a **sentimental** quality that is hard to define but easy to violate. It's not analytical. It's not a productivity tool. It feels like a serious martial arts space — a night-time dojo, not a fitness app. There is dignity to it.

---

## Who This Is For

Right now: the builder. This is a personal tool first. Features get built when the builder wants to use them.

Vision target user: intentional grapplers — practitioners training 3-5x/week who are beyond casual but not necessarily competitive. Blue belt and above. People for whom BJJ is a years-long psychological journey, not just exercise.

---

## What Journada Is NOT

These are hard constraints. Never suggest, build, or frame features around:

- **No social comparison or leaderboards.** The journey is personal. There is no ranking.
- **No "productivity" framing.** Journada is not about optimizing training. Never use that language.
- **No badge collection galleries.** Milestone *moments* (one-time toasts, visual upgrades) are fine. A persistent badge inventory UI is not. See `roadmap.md → Design Decision: No Badge/Achievement Gallery`.
- **No gamification mechanics** that optimize for logging volume over honest record-keeping.

---

## Before Writing Any Code

1. **Confirm the approach with the user first.** Never assume. Present the plan, get sign-off, then build.
2. **Read `DESIGN.md`** — the full design system. A feature that doesn't match it exactly is not done.
3. **Read `roadmap.md`** — check if the feature is already planned, in progress, or conflicts with a documented decision.
4. **Read the relevant existing components** before writing new ones. Understand the pattern first.

---

## The Done Bar

A feature is done when it **matches the design system exactly** — correct colors, typography, spacing, touch targets, and motion. Functionally working but visually off is not done. The design system is the bar, not a suggestion.

---

## Design System

Full reference: [`DESIGN.md`](DESIGN.md)

Key rules an agent must internalize:
- Background: `#0D1A14` (deep forest green — not black)
- Cards: `#152E22`
- Titles / stat numbers: `#F2E4A8` (champagne gold, `PALE_YELLOW`)
- Borders / accents: `#C4915F` (copper, `COPPER_BORDER` at 45% opacity)
- CTA / active state: `#DA7422` (burnt orange, `BRAND_ORANGE`)
- **No blue** anywhere in the UI except the `PRESTIGE_BLUE` (`#00B4FF`) token, which is reserved exclusively for streak/consecutive-day accents
- Two typefaces only: **Plus Jakarta Sans** (all UI) and **Cormorant Garamond** (display / narrative voice only — see `DESIGN.md §3` for strict role rules)
- Touch-first: 44px minimum tap targets, `touch-action: manipulation` on all buttons
- Mobile nav: bottom tab bar. Desktop: left sidebar rail.
- Glows are warm yellow halos — never blue or white glow (except `PRESTIGE_BLUE_GLOW` for streak cells)

All color tokens live in `frontend_app/src/lib/theme.ts`. Always import from there — never hardcode hex values.

---

## Dev Conventions

**Migrations**
- Numbered sequentially: `001`, `002`, … currently at `040`
- Auto-applied on server boot via `runMigrations()` in `server.ts`
- Always check the last migration number before writing a new one: `ls backend_api/migrations/ | sort | tail -5`
- SQL files only — no inline migration code

**Branches**
- Descriptive feature branch names: `feat/session-video-tagging`, `fix/transcode-ts-errors`
- All work through PRs before merging to main

**TypeScript**
- `strict: true` + `exactOptionalPropertyTypes: true` — the build will reject loose param types
- `req.params.*` is `string | undefined` in Express strict mode — always guard before use
- Run `npm run build` in `backend_api/` before committing. A failing build means the Railway deploy fails silently and runs the old code.

**Commit style**
- Conventional commits: `feat:`, `fix:`, `refactor:`, `chore:`
- Attribution lines at end (see repo commit history for format)

**Stack**
- Backend: Node/Express 5/TypeScript on Railway, port 5000
- Database: PostgreSQL (Supabase), migrations tracked in `schema_migrations` table
- Video storage: Cloudflare R2 — `r2Client.ts` for all R2 operations
- Frontend: React 18/Vite/TypeScript/Tailwind on Railway, port 3000
- PWA with offline queue (`offlineQueue.ts`) and read cache (`apiCache.ts`)

---

## Architecture

Full reference: [`build-structure.md`](build-structure.md) and [`Docs/architecture-topology.md`](Docs/architecture-topology.md)

Key patterns:
- API routes: `backend_api/src/routes/` → controllers → models → DB
- All shared API types: `frontend_app/src/types/api.ts` — single source of truth
- All API calls go through `frontend_app/src/lib/api.ts` — never fetch directly
- Component catalog: `frontend_app/docs/components.md`

---

## Roadmap

Full reference: [`roadmap.md`](roadmap.md)

Before starting any feature, check the roadmap. It tracks what's built `[x]`, in progress `[~]`, and planned `[ ]`, and includes documented decisions about what NOT to build and why.

---

## The Soul of the Product

When in doubt, ask: *does this add dignity to the record?*

Journada should feel like a serious practitioner's companion across a decade of training — not a streak app, not a workout logger, not a social network. The closest analogy is a well-made physical journal: it respects the person using it, it doesn't demand attention, and it gets better the longer you use it.

The emotional and psychological layer of BJJ — the fear, the growth, the relationships on the mat — is as real as the number of sessions logged. The product should honor both.
