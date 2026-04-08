import { test, expect, Page } from '@playwright/test';
import path from 'node:path';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots');
const TEST_EMAIL = `test-${Date.now()}@journada-e2e.com`;
const TEST_PASSWORD = 'TestPass123!';

async function snap(page: Page, name: string, testInfo: any) {
  const project = testInfo.project.name;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, project, `${name}.png`),
    fullPage: true,
  });
}

test.describe('Visual Overview', () => {
  // Run tests in this file sequentially — registration must happen first
  test.describe.configure({ mode: 'serial' });

  test('01 — login page', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await snap(page, '01-login', testInfo);
  });

  test('02 — register a test account', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();

    // Wait for navigation to /home after successful registration
    await page.waitForURL('**/home', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    await snap(page, '02-home-empty', testInfo);
  });

  test('03 — Path Ahead / home page', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    // Give UI time to render cards/animations
    await page.waitForTimeout(1000);
    await snap(page, '03-home', testInfo);
  });

  test('04 — Calendar page', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });

    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '04-calendar', testInfo);
  });

  test('05 — Analytics page', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });

    await page.goto('/analytics');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '05-analytics', testInfo);
  });

  test('06 — Profile page', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });

    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '06-profile', testInfo);
  });

  test('07 — Intentions page (enable first via profile)', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });

    // Enable intentions on profile page
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');

    // Enable intentions — custom div toggle next to "Training Intentions" label
    const toggleRow = page.locator('label', { has: page.getByText('Training Intentions') });
    await toggleRow.locator('div.rounded-full').click();
    await page.waitForTimeout(1000);

    await page.goto('/intentions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    await snap(page, '07-intentions', testInfo);
  });

});

// Standalone — not part of the serial chain above so it always runs
test.describe('Compact Heatmap Visual', () => {
  const COMPACT_EMAIL = `compact-${Date.now()}@journada-e2e.com`;
  const COMPACT_PASSWORD = 'TestPass123!';

  test('08 — Calendar compact heatmap view', async ({ page }, testInfo) => {
    // Register a fresh account
    await page.goto('/');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByPlaceholder('you@example.com').fill(COMPACT_EMAIL);
    await page.getByPlaceholder('••••••••').fill(COMPACT_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });

    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');

    // Switch to compact view
    await page.getByRole('button', { name: 'Compact view' }).click();
    await page.waitForTimeout(1200); // allow scroll-to-today animation
    await snap(page, '08-calendar-compact', testInfo);
  });
});
