// E2E coverage for Flow 3 of the smoke-test runbook (SetIntentionModal).
//
// Single-mode chip behavior: a tap promotes the chip to primary in one
// gesture; tapping the currently-primary chip deselects it. Long-press is
// disabled — the timer doesn't start and no fill ring renders.

import { test, expect, type Page, type Locator } from '@playwright/test';

const INTENTIONS_URL_RE = /\/api\/intentions(\?|$)/;

// FocusAreaChips uses short labels (FocusAreaChips.tsx:32-38) which copy
// straight into aria-label. Suffixes ", primary focus" / ", deep work" append
// when flags are set.
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

async function openIntentionModal(page: Page): Promise<void> {
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    // Trigger button uses the diamond glyph (◇), the modal's submit button
    // does not. The diamond is a reliable discriminator.
    const trigger = page.getByRole('button', { name: /◇.*focus/i }).first();
    await trigger.waitFor({ state: 'visible', timeout: 10_000 });
    await trigger.click();
    // Modal is open when the chip palette renders. Use Stand-up as a probe —
    // chips have role="switch", which doesn't appear elsewhere on the home page.
    await expect(chip(page, 'standup')).toBeVisible();
}

// Two RAFs: lets React commit the state update + re-render the parent so its
// handler closures see the latest selections before the next gesture fires.
async function settle(page: Page): Promise<void> {
    await page.evaluate(() => new Promise<void>(r =>
        requestAnimationFrame(() => requestAnimationFrame(() => r())),
    ));
}

// Single-mode tap behaves like a primary-promote: chip becomes primary, all
// others clear. We assert primary in the aria-label so the next gesture only
// runs after React commits the state.
async function singleTapPromote(c: Locator): Promise<void> {
    await c.click();
    await expect(c).toHaveAttribute('aria-checked', 'true');
    await expect(c).toHaveAccessibleName(/primary focus/i);
    await settle(c.page());
}

async function singleTapDeselect(c: Locator): Promise<void> {
    await c.click();
    await expect(c).toHaveAttribute('aria-checked', 'false');
    await settle(c.page());
}

async function longPress(target: Locator, ms: number): Promise<void> {
    const box = await target.boundingBox();
    if (!box) throw new Error('Cannot long-press a chip with no bounding box');
    const cx = box.x + box.width / 2;
    const cy = box.y + box.height / 2;
    const page = target.page();
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(ms);
    await page.mouse.up();
    await settle(page);
}

test.describe('Flow 3 — set an intention via single-mode chips', () => {
    test('3.2 tap promotes a chip to primary in one gesture', async ({ page }) => {
        await openIntentionModal(page);
        await singleTapPromote(chip(page, 'guard'));
    });

    test('3.3 tapping a different chip swaps primary', async ({ page }) => {
        await openIntentionModal(page);
        const guard = chip(page, 'guard');
        const subs  = chip(page, 'submissions');

        await singleTapPromote(guard);
        await singleTapPromote(subs);
        // Previous selection clears entirely in single mode.
        await expect(guard).toHaveAttribute('aria-checked', 'false');
    });

    test('3.4 tapping the currently-primary chip deselects it', async ({ page }) => {
        await openIntentionModal(page);
        const guard = chip(page, 'guard');
        await singleTapPromote(guard);
        await singleTapDeselect(guard);
    });

    test('3.5 long-press is a no-op in single mode (no deep_work flag)', async ({ page }) => {
        await openIntentionModal(page);
        const guard = chip(page, 'guard');
        await longPress(guard, 600);
        // Long-press in single mode collapses to a tap → chip becomes primary,
        // but no deep_work flag (the aria-label doesn't include "deep work").
        await expect(guard).toHaveAttribute('aria-checked', 'true');
        await expect(guard).toHaveAccessibleName(/primary focus/i);
        const name = await guard.getAttribute('aria-label');
        expect(name ?? '').not.toMatch(/deep work/i);
    });

    test('submitting the intention POSTs heading derived from primary chip', async ({ page }) => {
        await openIntentionModal(page);
        await singleTapPromote(chip(page, 'standup'));

        const reqPromise = page.waitForRequest(
            r => INTENTIONS_URL_RE.test(r.url()) && r.method() === 'POST',
            { timeout: 10_000 },
        );
        // Submit button has exact text "Set Focus" or "Set & Write" (no diamond).
        await page.getByRole('button', { name: /^(Set Focus|Set & Write)$/ }).click();
        const req = await reqPromise;
        const body = req.postDataJSON() as Record<string, unknown>;
        expect(body.heading).toBe('standup');
    });
});
