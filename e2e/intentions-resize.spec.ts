/**
 * Intentions desktop container width — sanity check after the responsive resize.
 *
 * Single test, single register call, multiple assertions across viewports.
 * Avoids burning the auth rate limit (10 req / 15 min per IP).
 */
import { test, expect, Page } from '@playwright/test';
import path from 'node:path';

const TEST_PASSWORD = 'TestPass123!';
const RUN_ID = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
const TEST_EMAIL = `intent-resize-${RUN_ID}@journada-e2e.com`;

async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => { /* ok */ });
  await page.waitForTimeout(450);
}

async function readContainerWidth(page: Page): Promise<number> {
  const heading = page.getByRole('heading', { name: /what you chose to work on/i });
  await expect(heading).toBeVisible();
  const container = heading.locator('xpath=ancestor::div[contains(@class, "mx-auto")][1]');
  const box = await container.boundingBox();
  if (!box) throw new Error('container box missing');
  return box.width;
}

test.describe('Intentions desktop — responsive sizing', () => {
  test('container scales across viewport breakpoints', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop-only');

    // The change matters at large viewports. The rail takes ~280px so on the
    // default 1280px desktop-chrome viewport the content area is ~1000px and
    // any max-width >= ~1000 looks identical. Set a real 24"-monitor viewport
    // up front so the assertions actually exercise the fix.
    await page.setViewportSize({ width: 1920, height: 1200 });

    // 1. Register (single auth call for the whole spec).
    await page.goto('/login?mode=register');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL('**/home', { timeout: 20_000 });
    await waitForPageReady(page);

    // 2. At 1920px viewport with a ~280px rail, content area is ~1640px.
    //    Old fixed max-width: 1100 → user complaint (dead margin).
    //    New 2xl:max-w-[1520px] → container should fill to ~1520.
    await page.goto('/intentions');
    await waitForPageReady(page);
    const width = await readContainerWidth(page);
    expect(
      width,
      'Container at 1920px viewport should now be substantially wider than the old 1100 cap',
    ).toBeGreaterThan(1300);
    expect(width, '2xl breakpoint caps at 1520').toBeLessThanOrEqual(1520);

    // 3. Screenshot at 1920×1200 so we can eyeball the spacing.
    // Belt-and-suspenders waits — the assertion above proves the heading was
    // visible at some point, but the page re-paints occasionally (auth context
    // settle, refetch hooks). Wait for the heading explicitly + extra paint
    // settle so the screenshot captures the real state, not a loader frame.
    const heading = page.getByRole('heading', { name: /what you chose to work on/i });
    await expect(heading).toBeVisible();
    await page.waitForFunction(
      () => !document.body.textContent?.includes('Loading your intentions'),
      undefined,
      { timeout: 10_000 },
    );
    await page.waitForTimeout(800);
    await page.screenshot({
      path: path.join(__dirname, 'screenshots', 'intentions-desktop-resized.png'),
      fullPage: false,
    });
  });
});
