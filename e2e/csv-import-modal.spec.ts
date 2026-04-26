/**
 * CSV Import Modal — desktop sizing verification.
 *
 * After the editorial resize pass (planned in
 * `~/.claude/plans/wondrous-questing-bonbon.md`), the modal should render
 * at ~1180px wide on desktop with the editorial header, while staying within
 * the viewport on mobile.
 *
 * Each test gets a fresh browser context, so we register-or-login in
 * `beforeEach` against a stable per-project email so subsequent tests reuse
 * the same account.
 *
 * Run:
 *   cd project/J2
 *   npx playwright test e2e/csv-import-modal.spec.ts --project=desktop-chrome
 *   npx playwright test e2e/csv-import-modal.spec.ts --project=mobile-chrome
 */
import { test, expect, Page } from '@playwright/test';
import path from 'node:path';

const TEST_PASSWORD = 'TestPass123!';

// Fresh email per test — avoids any cross-test auth coupling. Cheap.
function freshEmail(projectName: string): string {
  const stamp = Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  return `csv-${projectName}-${stamp}@journada-e2e.com`;
}

async function waitForPageReady(page: Page) {
  await page.waitForLoadState('networkidle').catch(() => { /* ok */ });
  await page.waitForTimeout(450); // PageContent crossfade buffer
}

async function registerAndLogin(page: Page, email: string) {
  await page.goto('/login?mode=register');
  await page.getByPlaceholder('you@example.com').fill(email);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
  await page.waitForURL('**/home', { timeout: 20_000 });
  await waitForPageReady(page);
}

async function openImportModal(page: Page) {
  await page.goto('/profile');
  await waitForPageReady(page);
  // Profile page renders Upload CSV inside a card — the button text is "↑ Upload CSV"
  await page.getByRole('button', { name: /Upload CSV/i }).click();
  await page.waitForTimeout(400); // animate-j2-modal-in (~280ms) settle
}

test.describe('CSV Import modal — sizing verification', () => {
  test.beforeEach(async ({ page }, testInfo) => {
    await registerAndLogin(page, freshEmail(testInfo.project.name));
  });

  test('desktop modal opens between 1100–1200px wide', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop-only sizing assertion');
    await openImportModal(page);

    const modal = page.getByTestId('csv-import-modal');
    await expect(modal).toBeVisible();

    const box = await modal.boundingBox();
    expect(box, 'modal should have a bounding box').not.toBeNull();
    expect(box!.width).toBeGreaterThanOrEqual(1100);
    expect(box!.width).toBeLessThanOrEqual(1200);
  });

  test('desktop renders the editorial header (copper label + serif title)', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop-only header assertion');
    await openImportModal(page);

    // Scope to inside the modal — Profile page also has an "◇ Import Training History"
    // section header for the Upload CSV card, which would collide with `page.getByText`.
    const modal = page.getByTestId('csv-import-modal');
    await expect(modal.getByText('◇ Import training history', { exact: true })).toBeVisible();
    await expect(modal.getByText('Bring the past on.')).toBeVisible();
    await expect(
      modal.getByText(/Upload a CSV, JSON, or Numbers spreadsheet/i),
    ).toBeVisible();
  });

  test('desktop drop-zone hint is visible', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop-only sizing');
    await openImportModal(page);
    const modal = page.getByTestId('csv-import-modal');
    await expect(modal.getByText(/click to browse/i)).toBeVisible();
    await expect(modal.getByText(/\.csv · \.json · \.numbers/i)).toBeVisible();
  });

  test('desktop screenshot of the upload step', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'desktop-chrome', 'desktop-only screenshot');
    await openImportModal(page);
    const modal = page.getByTestId('csv-import-modal');
    await modal.screenshot({
      path: path.join(__dirname, 'screenshots', 'csv-import-desktop-upload.png'),
    });
  });

  test('mobile modal stays within viewport', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name === 'desktop-chrome', 'mobile-only assertion');
    await openImportModal(page);

    const modal = page.getByTestId('csv-import-modal');
    await expect(modal).toBeVisible();

    const box = await modal.boundingBox();
    const viewport = page.viewportSize();
    expect(box, 'modal should have a bounding box').not.toBeNull();
    expect(viewport, 'viewport should be defined').not.toBeNull();
    // Mobile (Pixel 7 ~412px, iPhone 14 ~390px) — modal width must fit.
    expect(box!.width).toBeLessThanOrEqual(viewport!.width);
  });
});
