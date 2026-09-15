# Roadmap True-Up — Live Audit 2026-09-06

Playwright audit of the Railway deployment (`extraordinary-freedom-production.up.railway.app`)
against `roadmap.md` and `implementation-plans.md`. Desktop Chrome (1280×720) + Pixel 7.
Screenshots: `e2e/screenshots-roadmap-2026-09-06/{desktop-chrome,mobile-chrome}/`.
Spec: `e2e/roadmap-audit.spec.ts`, config: `e2e/playwright-remote.config.ts`, account: `e2e/audit-credentials.md`.

## Headline

**Production is 43 commits ahead of the local checkout, and the roadmap describes an app that no longer exists.**

- Local branch `claude/add-password-reset-rQAQq` is already merged (PR #206). `origin/main` has 43 newer commits; Railway runs main.
- Those 43 commits replaced the home page (hero deck / "table of contents"), retired `LogSessionForm` for the Margin Notes composer, added the Boa keepsake stamp + Collection, a desktop rail with five redesigned pages (Today, Journal, Intentions, Profile, Atlas), a Plus tier surface, and class-time notifications.
- Upstream `roadmap.md` changed by 3 lines over the same span. It still frames the home page as PathAhead + StatStrip + Rep Roulette inline card, and lists as `[ ]` several things that shipped.
- The audit account (fresh, one session) cannot exercise streak / Eight Gates / heatmap states. Those are marked "present in code, not visually verified."

## Roadmap status vs. reality

### Homepage Redesign — section is obsolete

| Roadmap says | Prod shows | Verdict |
|---|---|---|
| `[~]` Rep Roulette → FAB + bottom sheet | Dice button top-right of mobile header; opens a fixed-size drill popover (Reroll, → CLA). Fixed 260px width / fixed height landed upstream (`e80bdd23`, `8be83d36`). Desktop: not rendered. | **Done** (as a header popover, not a lower-right FAB + bottom sheet) |
| `[ ]` Primary CTA above the fold | Mobile: `+` in bottom nav (always visible) and "Keep writing" at y≈312/839. Desktop: "Log session" pinned in the rail. | **Done** |
| `[ ]` Training Telemetry hidden-panel UX | `StatStrip` no longer renders on any page (only `AdminProdDesignPage`). Home is a journal "Today" card. | **Moot** — remove |
| `[ ]` Mobile scroll depth (2×) | 839px content / 839px viewport = **1.00×** with one session. | **Done** (re-check with a full account) |

### Features that shipped but are still `[ ]`

| Item | Evidence |
|---|---|
| Belt rank milestones | Profile → "Belt Timeline … + Add promotion", desktop belt bar "click the belt to record a promotion" (`47b260a8`). |
| Push notifications / reminders | Profile → "Class times & notifications — three quiet pings around each class". The "you haven't logged in 5 days" nudge variant is **not** built; class-time reminders are. |
| Coach notes / video links | Profile → "Move Library — personal video clips of your techniques" + Journal "Techs" tab + `/technique` page. Built in a different shape than the roadmap text. |
| Single active intention per week | Now a product decision: Intentions page shows "Plus — a second intention alongside this one, and the full archive." Reframe as Plus-tier work, not a bug. |
| Journal autosave offline safety | Already `[x]` upstream (2026-07-23). Local roadmap copy is stale. |

### `[x]` items that changed shape or regressed

| Item | Evidence |
|---|---|
| Analytics custom date range | `/analytics` → `/atlas`. Mobile Atlas has 7D/2W/30D/3M/6M/1Y/All presets; **no custom start/end picker seen**. Desktop Atlas is Overlay / By week / Ghost / The study / Density with no range bar at all. Verify whether `TimeRangeBar` custom mode was intentionally dropped. |
| Session search + filter | Calendar has a search icon button and Journal has full-text "Search entries…" + pillar chips. Present; the audit heuristic missed it because the calendar button is icon-only. |
| Streaks / Eight Gates / StatStrip | `StatStrip` is gone from home. `j2-streak-cell` still applied in `CalendarHeatmap`, `HeatmapPreviewWidget`, `TrainingHeatmap`; `HeatmapPreviewWidget` is not imported by any page. Streak surfaces now live only in the calendar heatmap. Eight Gates toasts/tiers: present in code, **not visually verified** (needs multi-week account). |
| Frontend testing | Roadmap cites `LogSessionForm.test.tsx`; `LogSessionForm` was retired upstream (`954f5614`). |
| PWA | `manifest.webmanifest` (200), `sw.js` (200, 29 KB), `registerSW.js` served. Silent auto-update + `serve.json` no-cache landed upstream. Headless Playwright reports no active SW controller — false negative, not a regression. |

### Still genuinely not built (confirmed absent on both viewports)

- Goal tracking (weekly/monthly mat-hours target)
- Tournament / competition record
- Positional sparring tracker (Notes + Techs tabs exist; no position quick-log)
- Full Commitment hours stat (intensity 4–5) — not on Atlas
- Foundation Reps filter in Rep Roulette
- The Drop PR particle
- Eight Gates × Intention alignment (still blocked on alignment heuristic)
- Alignment heuristic rewrite
- Future-week intention setting — Intentions page shows only "Nothing active / Name one thing"; no date picker surfaced in the empty state
- CI/CD pipeline
- In-App Admin view — `/admin` → `/home` for a non-admin account. `AdminProdDesignPage` exists in code and `last_login_at` is recorded "for admin dashboard", so something exists behind an admin flag. Not verifiable with this account.
- Gold `@mention` styling (new upstream item, deferred)

### Design-decision conflict worth a call

`roadmap.md` → "Design Decision: No Badge/Achievement Gallery" says *never* build an earned/unearned icon grid.
Production Profile now has **"Collection — keepsake stamps struck for the moments you marked"** with four empty dashed circles and "Nothing struck yet. They arrive on the mat, not from a list." (`e58cf287` Boa keepsake stamp).
The copy honors the ethos, but the surface is an earned/unearned grid. Either update the decision text or reconcile.

## Nav / IA on prod (for the record)

- **Mobile bottom nav:** Home · Journal · `+` · Calendar · Profile. Atlas is not in the bottom nav (reachable from Calendar grid toggle / links).
- **Desktop rail:** Today · Journal · Intentions · Atlas (also active on `/calendar`) · Profile · "Log session" button · user chip.
- **Journal tabs (mobile):** Entries · Intentions · Notes · Techs.
- First-visit coachmarks on Calendar, Intentions, and the onboarding composer.

## Local-repo housekeeping found during the audit

- `git status` shows `backend_api/src/controllers/authController.ts` as modified. It is **not** a real edit: the index holds both `authController.ts` and `authcontroller.ts` (fixed upstream in `a2c8736c`) and Windows' case-insensitive FS can only materialize one. Pulling main resolves it. Do not commit the "diff".
- `.gitignore` now ignores `e2e/.auth/` (JWT storage state), `e2e/screenshots-roadmap-*/`, `e2e/playwright-report-remote/`.

## Testing infrastructure lessons

- Prod rate-limits `/auth/*` to **10 requests / 15 min per IP** and counts successes. Per-test login is not viable; the audit now authenticates once (`setup` project → `storageState`). The existing `usage.spec.ts` / `visual-overview.spec.ts` pattern of logging in per test will hit this against any deployed environment.
- Fresh accounts are gated to `/onboarding/*` until name → belt → first session → done completes. Any remote spec must drive onboarding or it will screenshot the name screen for every route (which is what the first run of this audit did).
- Coachmark dialogs make sibling content `aria-hidden`; `getByRole` can't see the page until the dialog unmounts.

## Suggested roadmap edits

1. Delete the **Homepage Redesign** section; replace with a one-liner pointing at the home hero deck (`fc6ae770`, `ab924a4b`, `5135c477`).
2. Flip to `[x]`: Belt rank milestones, Push notifications (as "class-time reminders"; keep a `[ ]` for inactivity nudges if still wanted), Coach notes / video links (as "Move Library + Techs").
3. Reframe **Single active intention** as a Plus-tier item.
4. Re-verify **Analytics custom date range** — mark `[~]` or `[x]` with new Atlas wording.
5. Add the new shipped surfaces so they have a home in the doc: Margin Notes composer, Boa stamp / Collection, desktop rail, Atlas, Plus.
6. Update **Frontend testing** / **E2E testing** rows: `LogSessionForm` retired; add "rate-limit handling" as a concrete blocker with the 10/15 number.
7. Resolve the **No Badge Gallery** decision vs. Collection.
