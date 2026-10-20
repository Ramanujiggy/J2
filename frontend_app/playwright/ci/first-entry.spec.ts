// The core journey a new person takes, end to end against a real backend:
// welcome → register → name → belt → first entry → home → read → edit → delete.
// If this is red, someone new to Journada cannot keep a record.

import { test, expect, type APIRequestContext } from '@playwright/test';

/** The server listens before its migrations finish on an empty database;
 *  wait until auth answers like a migrated server would (401, not 500). */
async function waitForMigrations(request: APIRequestContext) {
    await expect.poll(async () => {
        const res = await request.post('http://localhost:5000/auth/login', {
            data: { email: 'nobody@journada.test', password: 'not-a-real-password' },
            failOnStatusCode: false,
        });
        return res.status();
    }, { timeout: 60_000, intervals: [500, 1000, 2000] }).toBeLessThan(500);
}

test('a new person logs, reads, edits and deletes their first entry', async ({ page, request }) => {
    await waitForMigrations(request);
    const email = `e2e-${Date.now()}@journada.test`;

    await page.goto('/welcome');
    await expect(page.getByText('A quiet place for your training.')).toBeVisible();
    await page.getByRole('button', { name: 'Begin' }).click();

    await page.getByPlaceholder('you@example.com').fill(email);
    await page.getByPlaceholder('••••••••').fill('E2ePassword!2026');
    await page.getByRole('button', { name: 'Create Account' }).click();

    await expect(page).toHaveURL(/\/onboarding\/name/);
    await page.getByPlaceholder('Your name').fill('Robin');
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/onboarding\/belt/);
    await page.getByRole('button', { name: 'Blue' }).click();
    await page.getByRole('button', { name: 'Continue' }).click();

    await expect(page).toHaveURL(/\/onboarding\/first-session/);
    await page.getByRole('button', { name: 'Got it' }).click();
    await page.getByRole('button', { name: 'Write instead' }).click();
    await page.getByPlaceholder(/What would you like to remember/)
        .fill('Worked knee shield retention. https://youtu.be/dQw4w9WgXcQ');
    await page.getByRole('button', { name: 'Save entry' }).click();

    await expect(page).toHaveURL(/\/onboarding\/done/);
    await page.getByRole('button', { name: 'Continue' }).click();

    // Home lists the entry; opening it reads it back, link and video included.
    await expect(page).toHaveURL(/\/home/);
    const entryRow = page.getByRole('button', { name: /knee shield retention/ });
    await entryRow.click();
    await expect(page.getByRole('link', { name: 'Watch on YouTube' }))
        .toHaveAttribute('href', 'https://youtu.be/dQw4w9WgXcQ');

    // Edit.
    await page.getByRole('button', { name: 'EDIT' }).click();
    await page.getByPlaceholder(/What would you like to remember/).fill('Knee shield held up today.');
    await page.getByRole('button', { name: 'Save entry' }).click();
    await expect(page.getByRole('button', { name: /Knee shield held up today/ })).toBeVisible();

    // Delete, and the record is empty again.
    await page.getByRole('button', { name: /Knee shield held up today/ }).click();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.getByRole('button', { name: 'Confirm' }).click();
    await expect(page.getByRole('button', { name: /Knee shield held up today/ })).toHaveCount(0);
});
