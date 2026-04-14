import { test, Page } from '@playwright/test';
import path from 'node:path';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-intentions-audit');
const BASE = process.env.E2E_BASE_URL ?? 'https://extraordinary-freedom-production.up.railway.app';
const TEST_EMAIL = `intent-audit-${Date.now()}@journada-e2e.com`;
const TEST_PASSWORD = 'TestPass123!';

async function snap(page: Page, name: string, testInfo: any) {
  const project = testInfo.project.name;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, project, `${name}.png`),
    fullPage: true,
  });
}

test.describe('Intentions Page Audit', () => {
  test.describe.configure({ mode: 'serial' });

  test('01 — intentions page (empty state)', async ({ page }, testInfo) => {
    // Register fresh account
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });
    await page.waitForLoadState('networkidle');

    // Navigate to intentions
    await page.goto(BASE + '/intentions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '01-intentions-empty', testInfo);
  });

  test('02 — set intention modal', async ({ page }, testInfo) => {
    // Login
    await page.goto(BASE);
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to open set intention modal from home
    const setBtn = page.locator('button:has-text("Set intent")').first();
    if (await setBtn.isVisible()) {
      await setBtn.click();
      await page.waitForTimeout(800);
      await snap(page, '02-set-intention-modal', testInfo);
    } else {
      await snap(page, '02-home-no-set-intent-button', testInfo);
    }
  });
});
