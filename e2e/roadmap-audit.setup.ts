/**
 * One-time auth + onboarding for the roadmap audit. Runs as the `setup`
 * project in playwright-remote.config.ts and writes storageState so the
 * desktop/mobile projects reuse the session instead of hitting /auth/login
 * per test (prod limiter: 10 auth requests / 15 min per IP).
 *
 * Credentials: e2e/audit-credentials.md
 */
import { test as setup, expect } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const TEST_EMAIL    = 'audit@journada-audit.dev';
const TEST_PASSWORD = 'AuditPass123!';

export const AUDIT_STATE = path.join(__dirname, '.auth', 'audit-state.json');

setup('authenticate audit account', async ({ page }) => {
  fs.mkdirSync(path.dirname(AUDIT_STATE), { recursive: true });

  await page.goto('/login');
  await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
  await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
  await page.locator('form').getByRole('button', { name: /log in/i }).click();

  const loggedIn = await page
    .waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10_000 })
    .then(() => true)
    .catch(() => false);

  if (!loggedIn) {
    const rateLimited = await page.getByText(/too many attempts/i).isVisible().catch(() => false);
    if (rateLimited) throw new Error('Auth rate-limited (10 req / 15 min per IP). Wait and retry.');

    console.log('[setup] login failed — registering account');
    await page.goto('/login');
    await page.getByRole('button', { name: 'Register' }).click();
    await page.waitForTimeout(300);
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.locator('form').getByRole('button', { name: /create account/i }).click();
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 20_000 });
  }

  await page.waitForLoadState('networkidle');
  await page.waitForTimeout(800);

  if (page.url().includes('/onboarding')) {
    console.log(`[setup] onboarding detected at ${page.url()} — completing`);

    if (page.url().includes('/onboarding/name')) {
      await page.getByPlaceholder('Your name').fill('Audit');
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.waitForURL(/\/onboarding\/belt/, { timeout: 10_000 });
      await page.waitForTimeout(400);
    }

    if (page.url().includes('/onboarding/belt')) {
      await page.getByRole('button', { name: /^white$/i }).click();
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.waitForURL(/\/onboarding\/first-session/, { timeout: 10_000 });
      await page.waitForTimeout(600);
    }

    if (page.url().includes('/onboarding/first-session')) {
      // Dismiss the Pillars coachmark if it's up
      const gotIt = page.getByRole('button', { name: /got it/i });
      if (await gotIt.isVisible({ timeout: 2_000 }).catch(() => false)) {
        await gotIt.click();
        // Wait for the coachmark dialog to fully unmount — while it's open the
        // rest of the page is aria-hidden and getByRole can't see it.
        await page.getByRole('dialog').waitFor({ state: 'hidden', timeout: 5_000 }).catch(() => {});
        await page.waitForTimeout(400);
      }

      const sessionsPost = page.waitForResponse(
        r => r.url().includes('/api/sessions') && r.request().method() === 'POST',
        { timeout: 15_000 },
      );

      // Prod quick-capture: "Open mat? 60 min · Gi" → "Just mark attended ✓"
      const markAttended = page.getByText(/just mark attended/i).first();
      const hasQuickCapture = await markAttended
        .waitFor({ state: 'visible', timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (hasQuickCapture) {
        console.log('[setup] first-session: quick-capture UI — marking attended');
        await markAttended.click();
      } else {
        // Fallback: full LogSessionForm (pick a pillar, submit)
        console.log('[setup] first-session: full form UI — selecting pillar');
        const guard = page.getByRole('button', { name: /^Guard(?!\s+Passing)/ }).first();
        await expect(guard).toBeVisible({ timeout: 8_000 });
        for (let i = 0; i < 3; i++) {
          await guard.click({ force: true });
          await page.waitForTimeout(300);
          if (await page.locator('button[type="submit"]:not([disabled])').count() > 0) break;
        }
        await page.locator('form button[type="submit"]').first().click();
      }

      const resp = await sessionsPost;
      console.log(`[setup] first-session POST → ${resp.status()}`);
      await page.waitForURL(/\/onboarding\/done/, { timeout: 10_000 });
      await page.waitForTimeout(400);
    }

    if (page.url().includes('/onboarding/done')) {
      await page.getByRole('button', { name: /^continue$/i }).click();
      await page.waitForURL(url => !url.pathname.startsWith('/onboarding'), { timeout: 10_000 });
    }

    await page.waitForLoadState('networkidle');
    console.log(`[setup] onboarding complete → ${page.url()}`);
  }

  await page.goto('/home');
  await page.waitForLoadState('networkidle');
  expect(page.url(), 'should be on /home after setup').toContain('/home');

  await page.context().storageState({ path: AUDIT_STATE });
  console.log(`[setup] storageState saved → ${AUDIT_STATE}`);
});
