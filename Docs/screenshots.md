# Journada — App Screenshots

Dated screenshots of the app captured via Playwright automation against production-equivalent state.

---

## 2026-04-12 — Current State

Captured on **April 12, 2026** across two viewports:
- **Desktop** (1920 x 1080) — `screenshots/2026-04-12/desktop/`
- **Mobile** (Pixel 7 — 412 x 915) — `screenshots/2026-04-12/mobile/`

### Pages Captured

| # | Page | Desktop | Mobile |
|---|------|---------|--------|
| 01 | **Login** — Auth screen with Log In / Register toggle | [desktop](screenshots/2026-04-12/desktop/01-login.png) | [mobile](screenshots/2026-04-12/mobile/01-login.png) |
| 02 | **Home (empty)** — First-time user, no sessions logged | [desktop](screenshots/2026-04-12/desktop/02-home-empty.png) | [mobile](screenshots/2026-04-12/mobile/02-home-empty.png) |
| 03 | **Home** — Path Ahead with day carousel and weekly summary | [desktop](screenshots/2026-04-12/desktop/03-home.png) | [mobile](screenshots/2026-04-12/mobile/03-home.png) |
| 04 | **Calendar** — Year-at-a-glance heatmap | [desktop](screenshots/2026-04-12/desktop/04-calendar.png) | [mobile](screenshots/2026-04-12/mobile/04-calendar.png) |
| 05 | **Analytics** — Grappling Prism radar + chart views | [desktop](screenshots/2026-04-12/desktop/05-analytics.png) | [mobile](screenshots/2026-04-12/mobile/05-analytics.png) |
| 06 | **Profile** — Belt rank, home gym, feature toggles | [desktop](screenshots/2026-04-12/desktop/06-profile.png) | [mobile](screenshots/2026-04-12/mobile/06-profile.png) |
| 07 | **Intentions** — Weekly intention management + history | [desktop](screenshots/2026-04-12/desktop/07-intentions.png) | [mobile](screenshots/2026-04-12/mobile/07-intentions.png) |
| 08 | **Calendar (compact)** — GitHub contribution-graph style | [desktop](screenshots/2026-04-12/desktop/08-calendar-compact.png) | [mobile](screenshots/2026-04-12/mobile/08-calendar-compact.png) |

---

## How to Capture New Screenshots

From `project/J2/`:

```bash
# Against production
E2E_BASE_URL=https://extraordinary-freedom-production.up.railway.app npx tsx e2e/capture-screenshots.ts

# Against local dev servers
E2E_BASE_URL=http://localhost:4173 npx tsx e2e/capture-screenshots.ts
```

Screenshots are saved to `e2e/screenshots-YYYY-MM-DD/`. Copy the output into `Docs/screenshots/YYYY-MM-DD/` and add an entry to this file.
