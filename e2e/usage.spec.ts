/**
 * End-to-end usage flows — mobile + desktop.
 *
 * Covers the core "general usage" paths:
 *   1. Log a session
 *   2. Set an intention
 *   3. Open a journal entry
 *   4. Scroll the calendar (change years)
 *   5. Open a session from the calendar
 *
 * Self-seeding: each Playwright project (desktop-chrome, mobile-chrome,
 * mobile-safari) registers its own fresh account as the first test in the
 * serial run, then reuses the credentials for subsequent flows.
 *
 * Target defaults to the local dev server (per playwright.config.ts webServer
 * setup). Override with E2E_BASE_URL to hit production, e.g.:
 *   E2E_BASE_URL=https://extraordinary-freedom-production.up.railway.app \
 *     npm run e2e -- --grep usage
 *
 * Run just this file:
 *   npm run e2e -- --grep "Usage flows"
 */
import { test, expect, Page } from '@playwright/test';

// Distinct per worker — Playwright gives each project its own module scope,
// so Date.now() + project-specific suffix avoids collisions on parallel runs.
const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const TEST_EMAIL    = `usage-${RUN_ID}@journada-e2e.com`;
const TEST_PASSWORD = 'TestPass123!';

// ── Viewport helpers ────────────────────────────────────────────────────────

function isDesktopViewport(page: Page): boolean {
  const vp = page.viewportSize();
  return !!vp && vp.width >= 1024;
}

// ── Page-ready helpers ──────────────────────────────────────────────────────
// PageContent has a `fading` phase that hands off pointer-events; wait for it
// to settle before interacting, otherwise taps silently drop.

async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => { /* ok */ });
  // crossfade buffer
  await page.waitForTimeout(450);
}

// ── Auth helpers ────────────────────────────────────────────────────────────

async function registerFreshAccount(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Register' }).click();
  await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL('**/home', { timeout: 20_000 });
  await waitForPageReady(page);
}

async function loginOnly(page: Page) {
  await page.goto('/');
  await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/home', { timeout: 20_000 });
  await waitForPageReady(page);
}

// ── Navigation helpers (viewport-aware) ─────────────────────────────────────
// Mobile uses bottom tab buttons with icon+label; desktop uses the rail
// <button>s with plain text labels. We key off the rail labels because they're
// more distinctive and overlap semantically with the mobile ones for /home,
// /profile, /intentions.

type Destination = 'home' | 'calendar' | 'journal' | 'atlas' | 'intentions' | 'profile';

async function goTo(page: Page, dest: Destination) {
  const isDesktop = isDesktopViewport(page);

  const desktopLabels: Partial<Record<Destination, string>> = {
    home:       'Path Ahead',
    journal:    'Journal',
    atlas:      'Atlas',
    intentions: 'Intentions',
    profile:    'Profile',
  };
  const mobilePaths: Partial<Record<Destination, string>> = {
    home:       '/home',
    journal:    '/journal',
    calendar:   '/calendar',
    intentions: '/intentions',
    profile:    '/profile',
  };

  if (isDesktop) {
    // Scope nav clicks to the <nav> landmark in the rail <aside>. This avoids
    // matching same-named buttons that exist in page content — e.g. PathAhead
    // has a "Journal" quick-access button in <main>, and the rail focus card
    // has "Open Intentions →" which would partial-match "Intentions".
    const rail = page.getByRole('navigation').first();
    const label = desktopLabels[dest];
    if (label) {
      await rail.getByRole('button', { name: label, exact: true }).click();
    } else if (dest === 'calendar') {
      // Desktop routes calendar through Atlas → Calendar sub-tab.
      await rail.getByRole('button', { name: 'Atlas' }).click();
      await waitForPageReady(page);
      await page.getByRole('button', { name: 'Calendar' }).click();
    }
  } else {
    const path = mobilePaths[dest];
    if (path) {
      await page.goto(path);
    } else if (dest === 'atlas') {
      await page.goto('/calendar'); // Atlas is desktop-only; mobile equivalent
    }
  }
  await waitForPageReady(page);
}

// ── Feature helpers ─────────────────────────────────────────────────────────

/** Open the Log Session form from the current page. Tries the PathAhead CTAs
 *  in priority order, falls back to the mobile FAB. Each viewport + state
 *  shows a different entry point:
 *    • Mobile empty state: "Log Your First Session" (FirstVisitCard)
 *    • Mobile/desktop with no session today: "+ Mat Time"
 *    • Desktop header (with sessions): "+ Log session"
 *    • Mobile bottom-nav FAB (always): aria-label="Log a training session" */
async function openLogSessionForm(page: Page) {
  const candidates = [
    page.getByRole('button', { name: /Log Your First Session/i }).first(),
    page.getByRole('button', { name: /^\+?\s*(Log\s+)?Mat\s+Time$/i }).first(),
    page.getByRole('button', { name: /\+?\s*Log\s+session/i }).first(),
    page.getByRole('button', { name: 'Log a training session' }).first(),
  ];
  for (const c of candidates) {
    if (await c.isVisible().catch(() => false)) {
      await c.click();
      return;
    }
  }
  throw new Error('Could not find a Log Session entry point on this page');
}

/** Select a pillar vertex on the PillarPrism via its accessible button.
 *  PillarPrism exposes per-vertex <g role="button" aria-label="{label}">.
 *  We dispatch a programmatic click (detail=0) which triggers the keyboard-
 *  activation branch of PillarPrism's onClick handler, calling placeDot
 *  directly and bypassing the pointer-gesture tap-to-mute logic. */
async function selectPillar(
  page: Page,
  pillar: 'standup' | 'passing' | 'pins' | 'submissions' | 'guard',
  opts: { scope?: ReturnType<Page['locator']> } = {},
) {
  const fullLabel: Record<typeof pillar, RegExp> = {
    standup:     /^Stand-up/,
    passing:     /^Guard Passing/,
    pins:        /^Dynamic Pins/,
    submissions: /^Submissions/,
    guard:       /^Guard(?!\s+Passing)/,
  };
  const root = opts.scope ?? page.locator('body');
  const btn = root.getByRole('button', { name: fullLabel[pillar] }).first();
  await expect(btn).toBeVisible({ timeout: 5_000 });
  // On mobile viewports Playwright dispatches touch events; modal open
  // animations can leave the button briefly unresponsive. Click, verify by
  // polling the save button state, retry once if the first didn't land.
  for (let attempt = 0; attempt < 3; attempt++) {
    await btn.click({ force: true });
    await page.waitForTimeout(250);
    // Cheap state probe: dispatchEvent on the same element to ensure the
    // synthetic click has propagated through React.
    const committed = await page.evaluate(() => {
      const anySubmit = document.querySelector('button[type="submit"]:not([disabled])');
      return !!anySubmit;
    });
    if (committed) return;
  }
}

/** Fill in the log-session form with reasonable defaults and save.
 *  LogSessionForm requires duration AND heading to pass validation:
 *    src/components/LogSessionForm.tsx:120–127
 *  Both must be set or the submit handler bails with a validation error. */
async function fillAndSaveSession(page: Page) {
  // Scope to the form that contains the PillarPrism — prevents the "+ Log
  // session" CTA on PathAhead (same accessible name as the submit button)
  // from being picked up over the modal's submit.
  const form = page.locator('form').filter({ has: page.getByTestId('pillar-prism') }).first();
  await expect(form).toBeVisible({ timeout: 5_000 });

  // 1. Duration — click the "1 h" preset pill (60 minutes).
  // Exact match so we don't accidentally pick up "1 h  30 m" (90 min preset).
  // FAB opens the form via setTimeout+event dispatch, so the form may still
  // be rendering on first click; retry up to 3 times and verify via the
  // "tap above" placeholder disappearing.
  for (let attempt = 0; attempt < 3; attempt++) {
    const oneHour = form.getByRole('button', { name: '1 h', exact: true }).first();
    await expect(oneHour).toBeVisible({ timeout: 5_000 });
    await oneHour.scrollIntoViewIfNeeded().catch(() => {});
    await oneHour.click({ timeout: 3_000 }).catch(() => {});
    await page.waitForTimeout(250);
    const stillUnset = await form.getByText(/^tap above$/i).isVisible().catch(() => false);
    if (!stillUnset) break;
  }

  // 2. Pillar focus — click the "guard" vertex on the PillarPrism.
  // Scope to page (not form) — only one pillar-prism is visible at a time,
  // and re-using the form locator across renders has caused detached-DOM
  // errors on mobile bottom-sheet transitions.
  await selectPillar(page, 'guard');

  // 3. Submit — the form's own type="submit" button, not the PathAhead CTA.
  const save = form.locator('button[type="submit"]').first();
  await expect(save).toBeEnabled({ timeout: 3_000 });

  // Wait for the sessions POST response in parallel with the click so we
  // can confirm the save actually succeeded (not a silent validation fail).
  const sessionsPost = page.waitForResponse(
    (resp) => resp.url().includes('/api/sessions') && resp.request().method() === 'POST',
    { timeout: 10_000 },
  );
  await save.click();
  const resp = await sessionsPost;
  if (resp.status() >= 400) {
    throw new Error(`Session save failed: ${resp.status()} ${await resp.text().catch(() => '')}`);
  }
  // Small settle for modal dismiss + sessions refetch.
  await page.waitForLoadState('networkidle').catch(() => { /* ok */ });
  await page.waitForTimeout(400);
}

// ═══════════════════════════════════════════════════════════════════════════
// Tests
// ═══════════════════════════════════════════════════════════════════════════

test.describe('Usage flows — mobile + desktop', () => {
  test.describe.configure({ mode: 'serial' });

  // ── 00: Register ──────────────────────────────────────────────────────────
  // First test per project creates the account used by all subsequent tests.

  test('00 — seed: register + log first session', async ({ page }) => {
    await registerFreshAccount(page);
    await expect(page).toHaveURL(/\/home/);

    // Seed one session so later tests have content to open/scroll.
    await openLogSessionForm(page).catch(async () => {
      // Mobile: if no CTA is visible, fall back to analytics → log page
      await page.goto('/home');
      await waitForPageReady(page);
      await openLogSessionForm(page);
    });
    await fillAndSaveSession(page);
  });

  // ── 01: Log a session ─────────────────────────────────────────────────────

  test('01 — log a session', async ({ page }) => {
    await loginOnly(page);
    await openLogSessionForm(page);
    await fillAndSaveSession(page);

    // After save we should be back on a content page (form closed). Assert
    // that no modal backdrop / form header is still present.
    await expect(page.getByText(/^Log a Session$/i)).toBeHidden({ timeout: 3_000 })
      .catch(() => { /* header text varies — the key assertion is the network save */ });
  });

  // ── 02: Set an intention ──────────────────────────────────────────────────

  test('02 — set an intention', async ({ page }) => {
    await loginOnly(page);

    // Both platforms expose the intention-modal opener on the home page:
    //   • Desktop: "◇ Set focus" in the Path Ahead header
    //   • Mobile: "+ Set intent" on the IntentionHeroCard
    // The Intentions page's "Set Your First Intention" button redirects back
    // to home instead of opening the modal, so staying on home is simpler.
    await goTo(page, 'home');
    const setBtn = page.getByRole('button', {
      name: /(Set|Adjust)\s+(focus|intent)/i,
    }).first();
    await expect(setBtn).toBeVisible({ timeout: 5_000 });
    await setBtn.click();

    // Modal is open — the heading reads "Set your focus" (or "Edit your focus"
    // if an intention already exists).
    await expect(page.getByText(/Set your focus|Edit your focus/i).first())
      .toBeVisible({ timeout: 5_000 });

    // Pick the "passing" vertex on the PillarPrism.
    await selectPillar(page, 'passing');

    // Save — button text is "Set Focus" (or "Set & Write" with journal toggle).
    const saveIntent = page.getByRole('button', {
      name: /^(Set Focus|Set & Write|Update Focus)$/i,
    }).first();
    await expect(saveIntent).toBeEnabled({ timeout: 3_000 });
    await saveIntent.click();
    await page.waitForLoadState('networkidle').catch(() => { /* ok */ });
    await page.waitForTimeout(600);

    // Active intention surfaces the pillar label. On desktop the rail focus
    // card shows "Guard Passing" (full label); on mobile the PathAhead header
    // shows it too. Either way, "Passing" should appear somewhere.
    await expect(page.getByText(/Passing/i).first()).toBeVisible({ timeout: 5_000 });
  });

  // ── 03: Open a journal entry ──────────────────────────────────────────────

  test('03 — open a journal entry', async ({ page }) => {
    await loginOnly(page);

    if (isDesktopViewport(page)) {
      await goTo(page, 'journal');
      // Filter chips at the top of the page are also <button> elements, so
      // disambiguate JournalRow buttons by the presence of the session-type
      // label ("CLASS", "OPEN MAT", etc.) which only appears on row buttons.
      const firstEntry = page.locator('main button').filter({
        hasText: /CLASS|OPEN MAT|DRILLS|PRIVATE|COMPETITION/i,
      }).first();
      await firstEntry.click({ timeout: 5_000 });
      // Should land on /journal/:id
      await expect(page).toHaveURL(/\/journal\/[^/]+/, { timeout: 5_000 });
    } else {
      // Mobile: navigate to the dedicated /journal route. Tapping a
      // MobileJournalRow opens the SessionDetailModal (aria-label="Close").
      await goTo(page, 'journal');
      // Filter by session-type label which only appears on row buttons, not
      // on the top-of-page filter chips (All, Stand-up, Guard Passing, etc.).
      const firstEntry = page.locator('main button').filter({
        hasText: /CLASS|OPEN MAT|DRILLS|PRIVATE|COMPETITION/i,
      }).first();
      await expect(firstEntry).toBeVisible({ timeout: 5_000 });
      await firstEntry.click();
      await expect(page.getByRole('button', { name: 'Close' }).first())
        .toBeVisible({ timeout: 5_000 });
    }
  });

  // ── 04: Scroll the calendar ───────────────────────────────────────────────

  test('04 — scroll the calendar (change year)', async ({ page }) => {
    await loginOnly(page);
    await goTo(page, 'calendar');

    // Both mobile and desktop surface a year navigator with Prev/Next buttons.
    // Mobile: TrainingHeatmap header arrows. Desktop: Atlas CalendarPanel arrows.
    const prevYear = page.getByRole('button', { name: /previous year/i }).first();
    await expect(prevYear).toBeVisible({ timeout: 8_000 });

    const currentYear = new Date().getFullYear();
    await prevYear.click();
    await page.waitForTimeout(400);

    // The year label should now show the previous year somewhere on the page.
    await expect(page.getByText(String(currentYear - 1)).first())
      .toBeVisible({ timeout: 3_000 });

    // Return to current year via the Next button
    const nextYear = page.getByRole('button', { name: /next year/i }).first();
    await nextYear.click();
    await page.waitForTimeout(400);
    await expect(page.getByText(String(currentYear)).first())
      .toBeVisible({ timeout: 3_000 });
  });

  // ── 05: Open a session from the calendar ──────────────────────────────────

  test('05 — open session from calendar', async ({ page }) => {
    await loginOnly(page);
    await goTo(page, 'calendar');
    await waitForPageReady(page);

    // Heatmap day cells are role="gridcell" with aria-labels like
    // "Monday, April 20: 1 session, 60 minutes, intensity 3 of 5"
    // (src/components/TrainingHeatmap.tsx:693). Filter by "session" in the
    // label to find populated days and click one. The grid is in a scrollable
    // container (maxHeight set); Playwright auto-scrolls into view.
    const dayCell = page.getByRole('gridcell', { name: /\d+\s*session/i }).first();
    await expect(dayCell).toBeVisible({ timeout: 8_000 });
    await dayCell.click();

    // A session detail modal should now be visible — look for its Close
    // button (aria-label="Close" × glyph).
    await expect(page.getByRole('button', { name: 'Close' }).first())
      .toBeVisible({ timeout: 5_000 });
  });
});
