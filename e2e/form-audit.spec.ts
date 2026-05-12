import { test, Page } from '@playwright/test';
import path from 'node:path';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-form-audit');
const BASE = process.env.E2E_BASE_URL ?? 'https://extraordinary-freedom-production.up.railway.app';
const TEST_EMAIL = `form-audit-${Date.now()}@journada-e2e.com`;
const TEST_PASSWORD = 'TestPass123!';

async function snap(page: Page, name: string, testInfo: any) {
  const project = testInfo.project.name;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, project, `${name}.png`),
    fullPage: true,
  });
}

let registered = false;
async function login(page: Page) {
  await page.goto(BASE);
  if (!registered) {
    // Register a fresh account
    await page.getByRole('button', { name: 'Register' }).click();
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Create Account' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
    registered = true;
  } else {
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: 'Log In' }).click();
    await page.waitForURL('**/home', { timeout: 15000 });
    await page.waitForLoadState('networkidle');
  }
}

test.describe('Log Session Form Audit', () => {
  test.describe.configure({ mode: 'serial' });

  test('01 — form initial state (top)', async ({ page }, testInfo) => {
    await login(page);
    // Open log session form
    await page.waitForTimeout(1000);
    // Click the "+ Mat Time" button or equivalent
    const matBtn = page.locator('button:has-text("Mat Time")').first();
    if (await matBtn.isVisible()) {
      await matBtn.click();
    } else {
      // Try the "Log Your First Session" button
      const logFirst = page.locator('button:has-text("Log Your First Session")').first();
      if (await logFirst.isVisible()) await logFirst.click();
    }
    await page.waitForTimeout(800);
    await snap(page, '01-form-top', testInfo);
  });

  test('02 — form with selections made (section 1)', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1000);
    const matBtn = page.locator('button:has-text("Mat Time")').first();
    if (await matBtn.isVisible()) await matBtn.click();
    else {
      const logFirst = page.locator('button:has-text("Log Your First Session")').first();
      if (await logFirst.isVisible()) await logFirst.click();
    }
    await page.waitForTimeout(800);

    // Select No-Gi
    await page.locator('button:has-text("No-Gi")').first().click();
    // Select Drilling
    await page.locator('button:has-text("Drilling")').first().click();
    // Tap duration + button (the one inside the form, near the "−" button)
    const durPlusBtn = page.locator('button').filter({ hasText: /^\+$/ }).first();
    await durPlusBtn.click();
    await durPlusBtn.click();
    await durPlusBtn.click(); // 1h 30m
    // Select intensity 4
    await page.locator('button').filter({ hasText: /^4$/ }).first().click();

    await page.waitForTimeout(300);
    await snap(page, '02-form-section1-filled', testInfo);
  });

  test('03 — form scrolled to section 2 (prism)', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1000);
    const matBtn = page.locator('button:has-text("Mat Time")').first();
    if (await matBtn.isVisible()) await matBtn.click();
    else {
      const logFirst = page.locator('button:has-text("Log Your First Session")').first();
      if (await logFirst.isVisible()) await logFirst.click();
    }
    await page.waitForTimeout(800);

    // Scroll to the prism section
    const prismHeading = page.locator('text=What did you work on?');
    await prismHeading.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await snap(page, '03-form-section2-prism', testInfo);
  });

  test('04 — form scrolled to section 3 (details + submit)', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1000);
    const matBtn = page.locator('button:has-text("Mat Time")').first();
    if (await matBtn.isVisible()) await matBtn.click();
    else {
      const logFirst = page.locator('button:has-text("Log Your First Session")').first();
      if (await logFirst.isVisible()) await logFirst.click();
    }
    await page.waitForTimeout(800);

    // Scroll to bottom
    const submitBtn = page.locator('button:has-text("Save Session")');
    await submitBtn.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);
    await snap(page, '04-form-section3-details', testInfo);
  });

  test('05 — full form scrolled view', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1000);
    const matBtn = page.locator('button:has-text("Mat Time")').first();
    if (await matBtn.isVisible()) await matBtn.click();
    else {
      const logFirst = page.locator('button:has-text("Log Your First Session")').first();
      if (await logFirst.isVisible()) await logFirst.click();
    }
    await page.waitForTimeout(800);

    // Full page screenshot captures entire scrollable area
    await snap(page, '05-form-full-page', testInfo);
  });
});
