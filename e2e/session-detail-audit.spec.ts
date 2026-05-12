import { test, Page } from '@playwright/test';
import path from 'node:path';

const SCREENSHOTS_DIR = path.join(__dirname, 'screenshots-session-detail');
const BASE = process.env.E2E_BASE_URL ?? 'https://extraordinary-freedom-production.up.railway.app';
// Use a known account that has sessions
const TEST_EMAIL = process.env.E2E_EMAIL ?? 'robertsrealemail@gmail.com';
const TEST_PASSWORD = process.env.E2E_PASSWORD ?? 'TestPass123!';

async function snap(page: Page, name: string, testInfo: any) {
  const project = testInfo.project.name;
  await page.screenshot({
    path: path.join(SCREENSHOTS_DIR, project, `${name}.png`),
    fullPage: true,
  });
}

async function login(page: Page) {
  await page.goto(BASE);
  await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.locator('form').getByRole('button', { name: 'Log In' }).click();
  await page.waitForURL('**/home', { timeout: 15000 });
  await page.waitForLoadState('networkidle');
}

test.describe('Session Detail Modal Audit', () => {
  test.describe.configure({ mode: 'serial' });

  test('01 — session detail view (from week list)', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1500);

    // Try to find a session card to tap - look for any session button in the week view
    // First try switching to list view
    const listBtn = page.locator('button[aria-label="List view"]');
    if (await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(500);
    }

    // Click the first session card
    const sessionCard = page.locator('[data-testid="week-list"] button').first();
    if (await sessionCard.isVisible()) {
      await sessionCard.click();
      await page.waitForTimeout(800);
      await snap(page, '01-detail-view-top', testInfo);
    } else {
      // Try clicking a day indicator that has a session
      const dayWithSession = page.locator('button').filter({ hasText: /^\d+$/ }).first();
      await dayWithSession.click();
      await page.waitForTimeout(800);
      await snap(page, '01-detail-view-top', testInfo);
    }
  });

  test('02 — session detail scrolled down', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1500);

    const listBtn = page.locator('button[aria-label="List view"]');
    if (await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(500);
    }

    const sessionCard = page.locator('[data-testid="week-list"] button').first();
    if (await sessionCard.isVisible()) {
      await sessionCard.click();
      await page.waitForTimeout(800);
      // Try to scroll to bottom of modal
      const editBtn = page.locator('button:has-text("Edit")');
      if (await editBtn.isVisible()) {
        await editBtn.scrollIntoViewIfNeeded();
        await page.waitForTimeout(300);
      }
      await snap(page, '02-detail-view-bottom', testInfo);
    }
  });

  test('03 — edit mode', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1500);

    const listBtn = page.locator('button[aria-label="List view"]');
    if (await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(500);
    }

    const sessionCard = page.locator('[data-testid="week-list"] button').first();
    if (await sessionCard.isVisible()) {
      await sessionCard.click();
      await page.waitForTimeout(800);

      // Click Edit button
      const editBtn = page.locator('button:has-text("Edit")');
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(500);
        await snap(page, '03-edit-mode-top', testInfo);
      }
    }
  });

  test('04 — edit mode scrolled down', async ({ page }, testInfo) => {
    await login(page);
    await page.waitForTimeout(1500);

    const listBtn = page.locator('button[aria-label="List view"]');
    if (await listBtn.isVisible()) {
      await listBtn.click();
      await page.waitForTimeout(500);
    }

    const sessionCard = page.locator('[data-testid="week-list"] button').first();
    if (await sessionCard.isVisible()) {
      await sessionCard.click();
      await page.waitForTimeout(800);

      const editBtn = page.locator('button:has-text("Edit")');
      if (await editBtn.isVisible()) {
        await editBtn.click();
        await page.waitForTimeout(500);
        // Scroll to Save button
        const saveBtn = page.locator('button:has-text("Save")');
        if (await saveBtn.isVisible()) {
          await saveBtn.scrollIntoViewIfNeeded();
          await page.waitForTimeout(300);
        }
        await snap(page, '04-edit-mode-bottom', testInfo);
      }
    }
  });
});
