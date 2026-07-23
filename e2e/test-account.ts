// Single shared e2e test account.
//
// Reused across every spec via `loginAsTestUser()` below. Idempotent: the
// first run registers, every subsequent run logs in. Eliminates the
// 140-user accumulation problem the project had with `freshEmail()` per
// test run.
//
// Trade-off: tests share state on this account, so any assertion that
// expects "exactly N sessions" needs to be relaxed to "at least N" or
// pre-clean. Most existing specs assert UI behavior, not row counts —
// safe by default.
//
// Parallel safety: playwright.config.ts uses `workers: 1` so all specs
// run serially in a single worker. If e2e runs become painfully slow,
// the escape hatch is one account per Playwright project (3 accounts:
// desktop-chrome / mobile-chrome / mobile-safari) which would let
// `workers: 3` keep parallelism alive.

import type { Page } from '@playwright/test';

export const TEST_EMAIL    = 'e2e@journada-e2e.com';
export const TEST_PASSWORD = 'TestPass123!';

/**
 * Lands the page on /home (or wherever post-auth lands) authed as the
 * shared test account. Tries login first; if the account doesn't exist
 * (first run on a fresh DB), falls back to register.
 */
export async function loginAsTestUser(page: Page): Promise<void> {
    await page.goto('/login');
    await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
    await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: /^Log In$/ }).click();

    // Did login succeed? Watch for either the URL to leave /login OR
    // an error message to surface. Whichever wins, we react.
    const errorAppeared = await page
        .getByText(/invalid|incorrect|not found|no account/i)
        .isVisible({ timeout: 1500 })
        .catch(() => false);

    if (errorAppeared) {
        // First run on this DB — register the account, then it's
        // persistent for every future run.
        await page.goto('/login?mode=register');
        await page.getByPlaceholder('you@example.com').fill(TEST_EMAIL);
        await page.getByPlaceholder('••••••••').fill(TEST_PASSWORD);
        await page.getByRole('button', { name: /create account/i }).click();
    }

    // Auth flow lands on /home (or /onboarding/* for fresh registrations).
    // Wait until we're off the login page.
    await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 10_000 });
}
