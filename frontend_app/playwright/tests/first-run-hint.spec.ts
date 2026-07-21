// E2E coverage for the first-run hint persistence.
//
// The hint reads "Tap to add. Double-tap to set your focus. Hold for deep work."
// and dismisses on first successful save. Persisted via
// localStorage[journada.chip_input.hint_dismissed].
//
// We force-clear that key per test, since the auth storageState carries
// localStorage from a previously-saved-then-dismissed state across runs.

import { test, expect, type Page } from '@playwright/test';

const HINT_KEY  = 'journada.chip_input.hint_dismissed';
const HINT_TEXT = /Tap to add\. Double-tap to set your focus\. Hold for deep work\./i;

async function openLogFormFresh(page: Page): Promise<void> {
    await page.goto('/home');
    // Strip the dismissed flag *after* navigation so the auth token survives.
    await page.evaluate(key => window.localStorage.removeItem(key), HINT_KEY);
    // Reload so the FocusAreaChips constructor re-reads localStorage on next mount.
    await page.reload();
    await page.waitForLoadState('networkidle');
    const saveBtn = page.getByRole('button', { name: /save session/i });
    for (let i = 0; i < 10; i++) {
        await page.evaluate(() => window.dispatchEvent(new CustomEvent('journada:open-log-form')));
        try {
            await saveBtn.waitFor({ state: 'visible', timeout: 1000 });
            return;
        } catch { /* retry */ }
    }
    throw new Error('Log form modal did not open after 10 dispatch attempts.');
}

test.describe('First-run hint', () => {
    test('hint is visible on first open with cleared localStorage', async ({ page }) => {
        await openLogFormFresh(page);
        await expect(page.getByText(HINT_TEXT)).toBeVisible();
    });

    test('"got it" button dismisses the hint and persists the flag', async ({ page }) => {
        await openLogFormFresh(page);
        await page.getByRole('button', { name: /got it/i }).click();
        await expect(page.getByText(HINT_TEXT)).toHaveCount(0);
        const flag = await page.evaluate(key => window.localStorage.getItem(key), HINT_KEY);
        expect(flag).toBe('1');
    });

    test('hint stays gone across page reloads once dismissed', async ({ page }) => {
        await openLogFormFresh(page);
        await page.getByRole('button', { name: /got it/i }).click();
        await page.reload();
        await page.waitForLoadState('networkidle');
        const saveBtn = page.getByRole('button', { name: /save session/i });
        for (let i = 0; i < 10; i++) {
            await page.evaluate(() => window.dispatchEvent(new CustomEvent('journada:open-log-form')));
            try { await saveBtn.waitFor({ state: 'visible', timeout: 1000 }); break; } catch { /* retry */ }
        }
        await expect(page.getByText(HINT_TEXT)).toHaveCount(0);
    });
});
