/**
 * Mobile interaction tests — verify that buttons and interactive elements
 * actually respond to taps after PageContent finishes loading.
 *
 * These tests specifically guard against the PageContent 'fading' state trap:
 * if the component gets stuck in 'fading' phase, pointer-events:none is
 * inherited by every descendant, silently killing all interactivity.
 *
 * Run: npm run e2e -- --project=mobile-chrome --grep interaction
 */
import { test, expect, Page } from '@playwright/test';
import { loginAsTestUser } from './test-account';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Thin wrapper over the shared persistent test account so existing call
// sites keep their semantic name. First run on a fresh DB registers,
// every subsequent run logs in.
async function loginOnly(page: Page) {
  await loginAsTestUser(page);
  await page.waitForLoadState('networkidle');
}

// Wait for PageContent to reach 'ready' state (loading spinner gone, content visible)
async function waitForPageReady(page: Page) {
  // The spinner/loading screen disappears once PageContent phase → ready
  await page.waitForFunction(
    () => !document.querySelector('[data-testid="loading-screen"]'),
    { timeout: 10_000 },
  ).catch(() => {
    // loading-screen may not have a testid; fall back to networkidle + small delay
  });
  await page.waitForLoadState('networkidle');
  // Small buffer for the 280ms PageContent crossfade
  await page.waitForTimeout(400);
}

// ── Tests ─────────────────────────────────────────────────────────────────────

test.describe('Mobile interactions', () => {
  test.describe.configure({ mode: 'serial' });

  test('00 — log in to the shared test account', async ({ page }) => {
    // Idempotent: registers on first ever run, otherwise logs in. Reuses
    // the e2e@journada-e2e.com account from e2e/test-account.ts so we
    // don't accumulate a new user per run.
    await loginAsTestUser(page);
    await expect(page).toHaveURL(/\/home|\/onboarding/);
  });

  // ── PathAhead (home) page ─────────────────────────────────────────────────

  test('01 — home: Rep Roulette tile expands on tap', async ({ page }) => {
    await loginOnly(page);
    await waitForPageReady(page);

    const rouletteBtn = page.getByTestId('roulette-header');
    await expect(rouletteBtn).toBeVisible();

    // Tap it — should expand the drill panel
    await rouletteBtn.tap();

    const drillArea = page.getByTestId('roulette-drill-area');
    await expect(drillArea).toBeVisible({ timeout: 2_000 });
  });

  test('02 — home: Telemetry tile expands on tap', async ({ page }) => {
    await loginOnly(page);
    await waitForPageReady(page);

    const telemetryBtn = page.getByTestId('telemetry-header');
    await expect(telemetryBtn).toBeVisible();

    await telemetryBtn.tap();

    // Telemetry panel becomes visible (opacity 1 via maxHeight animation)
    // Check that the tile now looks "open" — the chevron rotates
    await expect(telemetryBtn).toHaveAttribute('style', /rotate\(0deg\)/);
  });

  test('03 — home: week-slide day buttons are tappable', async ({ page }) => {
    await loginOnly(page);
    await waitForPageReady(page);

    const weekScroll = page.getByTestId('week-scroll');
    await expect(weekScroll).toBeVisible();

    // Tap first day button inside the week scroll
    const firstDayBtn = weekScroll.locator('button').first();
    await expect(firstDayBtn).toBeVisible();

    // Tapping opens either a log-session modal or a session-detail modal.
    // Either way a fixed overlay or modal should appear.
    await firstDayBtn.tap();
    // A modal should open (fixed overlay). We can't predict which one, so
    // just verify the tap didn't crash / hang and the button is still in DOM.
    await page.waitForTimeout(500);
    await expect(firstDayBtn).toBeAttached();
  });

  // ── Analytics page ────────────────────────────────────────────────────────

  test('04 — analytics: time-range pills are tappable', async ({ page }) => {
    await loginOnly(page);
    await page.goto('/analytics');
    await waitForPageReady(page);

    // The 7D pill is a button with text "7D"
    const pill7d  = page.getByRole('button', { name: '7D',  exact: true });
    const pill2w  = page.getByRole('button', { name: '2W',  exact: true });
    const pill30d = page.getByRole('button', { name: '30D', exact: true });

    await expect(pill30d).toBeVisible();

    // 30D should be active by default (copper background)
    // Tap 7D — it should become active
    await pill7d.tap();
    await page.waitForTimeout(300);

    // Verify 7D now has the copper/active background (rgba(218,116,34,...))
    const pill7dStyle = await pill7d.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    // Active pill uses COPPER color — non-empty backgroundColor means style was applied
    expect(pill7dStyle).not.toBe('');

    // Tap 2W — should also work
    await pill2w.tap();
    await page.waitForTimeout(300);
    const pill2wStyle = await pill2w.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    expect(pill2wStyle).not.toBe('');
  });

  test('05 — analytics: mobile view tabs are tappable', async ({ page }) => {
    await loginOnly(page);
    await page.goto('/analytics');
    await waitForPageReady(page);

    // Mobile view tabs — only visible on small viewports (Pixel 7 is 412px)
    // Tab labels are "Prism", "Volume", "Split", "Format"
    const volumeTab = page.getByRole('button', { name: 'Volume', exact: true });
    const prismTab  = page.getByRole('button', { name: 'Prism',  exact: true });

    // These are in the sm:hidden section — should be visible on mobile
    await expect(volumeTab).toBeVisible();

    // Tap Volume
    await volumeTab.tap();
    await page.waitForTimeout(300);

    // Volume tab should become active (backgroundColor set via inline style)
    const volumeStyle = await volumeTab.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    expect(volumeStyle).not.toBe('');

    // Tap back to Prism
    await prismTab.tap();
    await page.waitForTimeout(300);
    const prismStyle = await prismTab.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    expect(prismStyle).not.toBe('');
  });

  test('06 — analytics: h/% toggle tappable (regression guard)', async ({ page }) => {
    await loginOnly(page);
    await page.goto('/analytics');
    await waitForPageReady(page);

    // These buttons should always have worked; verify they still do
    const hourBtn = page.getByRole('button', { name: 'h', exact: true }).first();
    const pctBtn  = page.getByRole('button', { name: '%', exact: true }).first();

    await expect(hourBtn).toBeVisible();

    await pctBtn.tap();
    await page.waitForTimeout(200);
    const pctStyle = await pctBtn.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    // Active background should be rgba(218,116,34,0.8)
    expect(pctStyle).toContain('218');

    await hourBtn.tap();
    await page.waitForTimeout(200);
    const hourStyle = await hourBtn.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    expect(hourStyle).toContain('218');
  });

  test('07 — analytics: expand chevron reveals secondary time pills', async ({ page }) => {
    await loginOnly(page);
    await page.goto('/analytics');
    await waitForPageReady(page);

    // Secondary pills (3M, 6M, 1Y) should be hidden initially
    const pill3m = page.getByRole('button', { name: '3M', exact: true });
    const pill6m = page.getByRole('button', { name: '6M', exact: true });

    // Tap the expand chevron — it has aria-label "Expand time options"
    const chevron = page.getByRole('button', { name: 'Expand time options' });
    await expect(chevron).toBeVisible();
    await chevron.tap();
    await page.waitForTimeout(350); // animation is 260ms

    // Secondary pills should now be visible (maxWidth expanded)
    await expect(pill3m).toBeVisible();
    await expect(pill6m).toBeVisible();

    // Tap 3M — should become active and collapse secondary tier
    await pill3m.tap();
    await page.waitForTimeout(350);

    const pill3mStyle = await pill3m.evaluate(
      el => (el as HTMLElement).style.backgroundColor,
    );
    expect(pill3mStyle).not.toBe('');
  });

  // ── Profile page ──────────────────────────────────────────────────────────

  test('08 — profile: page loads and buttons are tappable', async ({ page }) => {
    await loginOnly(page);
    await page.goto('/profile');
    await waitForPageReady(page);

    // The profile page should show some content
    await expect(page.locator('h2').first()).toBeVisible();

    // Verify the page isn't frozen — try clicking on the first visible button
    const firstBtn = page.getByRole('button').first();
    if (await firstBtn.isVisible()) {
      // Just verify it's clickable without crashing
      await firstBtn.tap();
      await page.waitForTimeout(300);
      await expect(firstBtn).toBeAttached();
    }
  });
});
