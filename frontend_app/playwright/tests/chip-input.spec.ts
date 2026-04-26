// E2E coverage for Flow 1 of the smoke-test runbook (LogSessionForm).
//
// We target the running dev stack (Vite :3000 → Express :5000), open the log
// modal from the home page, exercise the chip palette via Playwright pointer
// events, then capture the resulting POST /api/sessions request to assert on
// payload shape (heading, tags, pillar_distribution, telemetry).
//
// Each gesture helper waits for the chip's aria-* state to commit before
// returning. Without that, click events race ahead of React renders and the
// next gesture (or the form submit) reads stale state.

import { test, expect, type Page, type Locator } from '@playwright/test';

const SAVE_URL_RE = /\/api\/sessions(\?|$)/;

// Chip aria-labels include suffixes like ", primary focus" or ", deep work"
// when selected. Anchor at start + match either comma or end-of-string so the
// same pattern hits both unselected and selected states.
// FocusAreaChips uses short labels for the visible chip text and copies them
// straight into aria-label (FocusAreaChips.tsx:325). Suffixes ", primary focus"
// and ", deep work" are appended when those flags are set.
const CHIP_RE = {
    standup:     /^Stand-up(,|$)/,
    passing:     /^Passing(,|$)/,
    pins:        /^Pins(,|$)/,
    submissions: /^Subs(,|$)/,
    guard:       /^Guard(,|$)/,
} as const;

type PillarKey = keyof typeof CHIP_RE;

function chip(page: Page, pillar: PillarKey): Locator {
    return page.getByRole('switch', { name: CHIP_RE[pillar] });
}

async function openLogForm(page: Page): Promise<void> {
    await page.goto('/home');
    // PathAheadPage listens for `journada:open-log-form` (dispatched by the
    // mobile FAB at AppShell:312). Using the event sidesteps viewport-specific
    // button visibility (desktop hides the FAB). The listener mounts via
    // useEffect on PathAheadPage; if we dispatch too early it's missed, so we
    // retry until the modal opens.
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

async function setMinDuration(page: Page): Promise<void> {
    await page.getByRole('button', { name: '+', exact: true }).first().click();
    // Confirm the new duration committed to the DOM before proceeding.
    await expect(page.locator('span', { hasText: /^30\s*m$/ })).toBeVisible();
}

// --- Gesture helpers (each waits for state to commit) -----------------------

async function tap(c: Locator): Promise<void> {
    const before = await c.getAttribute('aria-checked');
    await c.click();
    await expect(c).toHaveAttribute('aria-checked', before === 'true' ? 'false' : 'true');
}

async function setPrimary(c: Locator): Promise<void> {
    await c.dblclick();
    await expect(c).toHaveAttribute('aria-checked', 'true');
    await expect(c).toHaveAccessibleName(/primary focus/i);
}

async function setDeepWork(target: Locator, holdMs = 600): Promise<void> {
    const box = await target.boundingBox();
    if (!box) throw new Error('Cannot long-press a chip with no bounding box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const page = target.page();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(holdMs);
    await page.mouse.up();
    await expect(target).toHaveAccessibleName(/deep work/i);
}

async function clickAndCapture(page: Page): Promise<Record<string, unknown>> {
    const reqPromise = page.waitForRequest(
        r => SAVE_URL_RE.test(r.url()) && r.method() === 'POST',
        { timeout: 10_000 },
    );
    await page.getByRole('button', { name: /save session/i }).click();
    const req = await reqPromise;
    return req.postDataJSON() as Record<string, unknown>;
}

// --- Tests ------------------------------------------------------------------

test.describe('Flow 1 — log a session via chips', () => {
    test('1.1 single tap → distribution {standup:1}, telemetry false/false/1', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await tap(chip(page, 'standup'));

        const body = await clickAndCapture(page);
        expect(body.heading).toBe('standup');
        expect(body.tags).toEqual(['standup']);
        expect(body.pillar_distribution).toEqual({ standup: 1 });
        expect(body.had_primary).toBe(false);
        expect(body.had_deep_work).toBe(false);
        expect(body.selection_count).toBe(1);
    });

    test('1.2 double-tap → primary, telemetry had_primary=true', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await setPrimary(chip(page, 'guard'));

        const body = await clickAndCapture(page);
        expect(body.heading).toBe('guard');
        expect(body.tags).toEqual(['guard']);
        expect(body.pillar_distribution).toEqual({ guard: 1 });
        expect(body.had_primary).toBe(true);
        expect(body.had_deep_work).toBe(false);
        expect(body.selection_count).toBe(1);
    });

    test('1.3 three taps no primary → distribution split ~0.3333, telemetry false/false/3', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await tap(chip(page, 'standup'));
        await tap(chip(page, 'submissions'));
        await tap(chip(page, 'guard'));

        const body = await clickAndCapture(page);
        expect(body.had_primary).toBe(false);
        expect(body.had_deep_work).toBe(false);
        expect(body.selection_count).toBe(3);
        const dist = body.pillar_distribution as Record<string, number>;
        expect(Object.keys(dist).sort()).toEqual(['guard', 'standup', 'submissions']);
        for (const w of Object.values(dist)) expect(w).toBeCloseTo(0.3333, 3);
        // Heading derives to first-tapped pillar in tie scenarios.
        expect(body.heading).toBe('standup');
    });

    test('1.4 two taps + double-tap a third → 0.6 / 0.2 / 0.2 with primary on the third', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await tap(chip(page, 'standup'));
        await tap(chip(page, 'submissions'));
        await setPrimary(chip(page, 'guard'));

        const body = await clickAndCapture(page);
        expect(body.heading).toBe('guard');
        expect(body.had_primary).toBe(true);
        expect(body.selection_count).toBe(3);
        const dist = body.pillar_distribution as Record<string, number>;
        expect(dist.guard).toBeCloseTo(0.6, 2);
        expect(dist.standup).toBeCloseTo(0.2, 2);
        expect(dist.submissions).toBeCloseTo(0.2, 2);
    });

    test('1.5 primary transfer (double-tap A then B) → only B has primary', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await setPrimary(chip(page, 'guard'));
        await setPrimary(chip(page, 'submissions'));
        // Guard should still be selected (not deselected) but no longer primary.
        await expect(chip(page, 'guard')).toHaveAttribute('aria-checked', 'true');
        const guardName = await chip(page, 'guard').getAttribute('aria-label');
        expect(guardName ?? '').not.toMatch(/primary focus/i);

        const body = await clickAndCapture(page);
        expect(body.heading).toBe('submissions');
        expect(body.had_primary).toBe(true);
        const dist = body.pillar_distribution as Record<string, number>;
        // Subs primary (3 raw points), Guard selected only (1) → 0.75 / 0.25.
        expect(dist.submissions).toBeCloseTo(0.75, 2);
        expect(dist.guard).toBeCloseTo(0.25, 2);
        expect(body.selection_count).toBe(2);
    });

    test('1.6 long-press → deep_work flag, telemetry had_deep_work=true', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await setDeepWork(chip(page, 'guard'));

        const body = await clickAndCapture(page);
        expect(body.heading).toBe('guard');
        expect(body.had_primary).toBe(false);
        expect(body.had_deep_work).toBe(true);
        expect(body.selection_count).toBe(1);
        // 1 base + 1 deep_work = 2 raw points, sole pillar → 1.0 distribution.
        expect(body.pillar_distribution).toEqual({ guard: 1 });
    });

    test('1.7 same chip primary + deep-work → both flags', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await setPrimary(chip(page, 'guard'));
        await setDeepWork(chip(page, 'guard'));

        const body = await clickAndCapture(page);
        expect(body.had_primary).toBe(true);
        expect(body.had_deep_work).toBe(true);
        expect(body.selection_count).toBe(1);
    });

    test('1.9 tap a primary chip to deselect → form blocks submit', async ({ page }) => {
        await openLogForm(page);
        await setMinDuration(page);
        await setPrimary(chip(page, 'guard'));   // select + primary
        await tap(chip(page, 'guard'));          // deselect (aria-checked flips to false)
        // No selection → save should be blocked client-side.
        await page.getByRole('button', { name: /save session/i }).click();
        await expect(page.getByText(/Tap at least one focus area\./i)).toBeVisible();
    });
});
