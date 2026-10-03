/**
 * Roadmap Audit — runs against the live Railway deployment.
 * Run with: npx playwright test --config=e2e/playwright-remote.config.ts e2e/roadmap-audit.spec.ts
 *
 * Auth + onboarding happen once in roadmap-audit.setup.ts (storageState);
 * credentials in e2e/audit-credentials.md.
 *
 * Captures screenshots + checks for each open roadmap item so we can
 * true-up the roadmap status.
 */

import { test, Page } from '@playwright/test';
import path from 'node:path';
import fs from 'node:fs';

const OUT = path.join(__dirname, `screenshots-roadmap-${new Date().toISOString().slice(0,10)}`);
fs.mkdirSync(OUT, { recursive: true });

async function snap(page: Page, name: string, project: string) {
  const dir = path.join(OUT, project);
  fs.mkdirSync(dir, { recursive: true });
  await page.screenshot({ path: path.join(dir, `${name}.png`), fullPage: true });
}

/** Session comes from storageState written by roadmap-audit.setup.ts —
 *  no auth request here. Just sanity-check we weren't bounced to /login. */
async function auth(page: Page) {
  await page.goto('/home');
  await page.waitForLoadState('networkidle');
  if (page.url().includes('/login')) {
    throw new Error('storageState did not authenticate — re-run setup project');
  }
}

// ────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ────────────────────────────────────────────────────────────────────────────

test.describe('Home page', () => {
  test.describe.configure({ mode: 'serial' });

  test('01 — home overview + scroll depth', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Measure total page height vs viewport height
    const scrollHeight = await page.evaluate(() => document.body.scrollHeight);
    const viewportHeight = await page.evaluate(() => window.innerHeight);
    const scrollRatio = (scrollHeight / viewportHeight).toFixed(2);
    console.log(`[home] scroll depth: ${scrollHeight}px / ${viewportHeight}px viewport = ${scrollRatio}x`);

    await snap(page, '01-home', ti.project.name);

    // Check StatStrip is visible near top
    const statStrip = page.locator('[data-testid="stat-strip"], .stat-strip').first();
    const hasStatStrip = await statStrip.isVisible().catch(() => false);
    console.log(`[home] StatStrip visible: ${hasStatStrip}`);

    // Check for Rep Roulette FAB (mobile only — fixed button near bottom-right)
    const rouletteFab = page.locator('button[aria-label="Rep Roulette"]');
    const hasFab = await rouletteFab.isVisible().catch(() => false);
    console.log(`[home] Rep Roulette FAB visible: ${hasFab}`);

    // Check for primary CTA "Log" / "Record" button above fold
    const viewportH = viewportHeight;
    const ctaButton = page.locator('button', { hasText: /log|record|start|capture/i }).first();
    const ctaBox = await ctaButton.boundingBox().catch(() => null);
    if (ctaBox) {
      console.log(`[home] Primary CTA top: ${ctaBox.y}px (viewport: ${viewportH}px — ${ctaBox.y < viewportH ? 'ABOVE FOLD ✓' : 'BELOW FOLD ✗'})`);
    } else {
      console.log(`[home] Primary CTA: not found`);
    }

    // Check for goal tracking section
    const goalSection = page.getByText(/goal|target|hours.*goal|mat.*goal/i).first();
    const hasGoal = await goalSection.isVisible().catch(() => false);
    console.log(`[home] Goal tracking section: ${hasGoal}`);

    // Check for hero/capture card (new home screen v2)
    const heroCard = page.locator('[data-testid="hero-card"], [data-testid="capture-hero"]').first();
    const hasHero = await heroCard.isVisible().catch(() => false);
    console.log(`[home] Hero capture card: ${hasHero}`);
  });

  test('01b — home mobile scroll sections', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Scroll to bottom to see all sections
    await page.keyboard.press('End');
    await page.waitForTimeout(500);
    await snap(page, '01b-home-bottom', ti.project.name);

    // Check heatmap preview widget
    const heatmap = page.locator('[data-testid="heatmap-preview"]').first();
    const hasHeatmap = await heatmap.isVisible().catch(() => false);
    console.log(`[home-bottom] HeatmapPreview visible: ${hasHeatmap}`);
  });

  test('01c — rep roulette FAB open', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Open Rep Roulette FAB
    const fab = page.locator('button[aria-label="Rep Roulette"]');
    const fabVisible = await fab.isVisible().catch(() => false);
    if (fabVisible) {
      await fab.click();
      await page.waitForTimeout(600);
      await snap(page, '01c-roulette-open', ti.project.name);

      // Check card height stability (swipe through a few)
      const card = page.locator('.rounded-xl').filter({ hasText: /swipe/i }).first();
      const box1 = await card.boundingBox().catch(() => null);
      console.log(`[roulette] Card height: ${box1?.height ?? 'n/a'}px`);
    } else {
      console.log(`[roulette] FAB not visible on this viewport`);
      await snap(page, '01c-roulette-no-fab', ti.project.name);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CALENDAR PAGE
// ────────────────────────────────────────────────────────────────────────────

test.describe('Calendar page', () => {
  test('02 — calendar overview', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await snap(page, '02-calendar', ti.project.name);

    // Check for session search
    const searchToggle = page.locator('button', { hasText: /search/i }).first();
    const hasSearch = await searchToggle.isVisible().catch(() => false);
    console.log(`[calendar] Search toggle: ${hasSearch}`);

    // Check for compact view toggle
    const compactBtn = page.locator('button', { hasText: /compact/i }).first();
    const hasCompact = await compactBtn.isVisible().catch(() => false);
    console.log(`[calendar] Compact view button: ${hasCompact}`);
  });

  test('02b — calendar session detail + edit date', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try to click any existing session card
    const sessionCard = page.locator('[data-testid="session-card"], .session-card').first();
    const hasCard = await sessionCard.isVisible({ timeout: 3000 }).catch(() => false);
    if (hasCard) {
      await sessionCard.click();
      await page.waitForTimeout(800);
      await snap(page, '02b-session-detail', ti.project.name);

      // Check for editable date field in detail modal
      const dateField = page.locator('input[type="date"]').first();
      const hasDateEdit = await dateField.isVisible().catch(() => false);
      console.log(`[calendar] Session detail has editable date: ${hasDateEdit}`);
    } else {
      console.log(`[calendar] No session cards found (empty account)`);
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// ANALYTICS PAGE
// ────────────────────────────────────────────────────────────────────────────

test.describe('Analytics page', () => {
  test('03 — analytics overview', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/atlas');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    console.log(`[analytics] /atlas landed at: ${page.url()}`);
    await snap(page, '03-atlas', ti.project.name);

    // Check SkillRadar presence
    const radar = page.locator('[data-testid="skill-radar"], canvas, svg').first();
    const hasRadar = await radar.isVisible().catch(() => false);
    console.log(`[analytics] SkillRadar/chart visible: ${hasRadar}`);

    // Check custom date range / time window bar
    const timeBar = page.locator('button', { hasText: /7d|14d|30d|90d|1y|custom/i }).first();
    const hasTimeBar = await timeBar.isVisible().catch(() => false);
    console.log(`[analytics] Time range bar: ${hasTimeBar}`);

    // Check for Full Commitment hours stat (intensity 4-5 filter)
    const fullEffort = page.getByText(/full commitment|full effort|intensity.*4|intensity.*5/i).first();
    const hasFullEffort = await fullEffort.isVisible().catch(() => false);
    console.log(`[analytics] Full Commitment hours stat: ${hasFullEffort}`);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ────────────────────────────────────────────────────────────────────────────

test.describe('Profile page', () => {
  test('04 — profile overview', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await snap(page, '04-profile', ti.project.name);

    // Check for belt rank milestones section
    const milestones = page.getByText(/milestone|belt.*history|when.*belt/i).first();
    const hasMilestones = await milestones.isVisible().catch(() => false);
    console.log(`[profile] Belt rank milestones: ${hasMilestones}`);

    // Check for password reset option
    const pwReset = page.getByText(/reset password|change password|forgot/i).first();
    const hasPwReset = await pwReset.isVisible().catch(() => false);
    console.log(`[profile] Password reset link: ${hasPwReset}`);

    // Check for import + export sections
    const importBtn = page.locator('button', { hasText: /upload.*csv|import/i }).first();
    const hasImport = await importBtn.isVisible().catch(() => false);
    console.log(`[profile] CSV import button: ${hasImport}`);

    const exportBtn = page.locator('button', { hasText: /export|download/i }).first();
    const hasExport = await exportBtn.isVisible().catch(() => false);
    console.log(`[profile] CSV export button: ${hasExport}`);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// INTENTIONS PAGE
// ────────────────────────────────────────────────────────────────────────────

test.describe('Intentions page', () => {
  test('05 — intentions overview', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/intentions');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await snap(page, '05-intentions', ti.project.name);

    // Check for "set intention" / create button
    const createBtn = page.locator('button', { hasText: /set.*intention|new intention|add/i }).first();
    const hasCreate = await createBtn.isVisible().catch(() => false);
    console.log(`[intentions] Create button: ${hasCreate}`);

    // Try to open SetIntentionModal and check for next-week option
    if (hasCreate) {
      await createBtn.click();
      await page.waitForTimeout(600);
      await snap(page, '05b-intentions-modal', ti.project.name);

      // Check for date picker (future week setting)
      const datePicker = page.locator('input[type="date"]').first();
      const hasDatePicker = await datePicker.isVisible().catch(() => false);
      console.log(`[intentions] Modal has date picker (future week): ${hasDatePicker}`);

      // Check for presence category
      const presenceCat = page.getByText(/presence/i).first();
      const hasPresence = await presenceCat.isVisible().catch(() => false);
      console.log(`[intentions] "Presence" category option: ${hasPresence}`);

      await page.keyboard.press('Escape');
    }
  });
});

// ────────────────────────────────────────────────────────────────────────────
// LOG SESSION FORM
// ────────────────────────────────────────────────────────────────────────────

test.describe('Log session form', () => {
  test('06 — log session form overview', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Find and open the log session form
    const logBtn = page.locator('button', { hasText: /log|record|capture|start/i }).first();
    const hasLogBtn = await logBtn.isVisible().catch(() => false);
    console.log(`[log-form] Log button visible: ${hasLogBtn}`);
    if (hasLogBtn) {
      const logBtnBox = await logBtn.boundingBox();
      const vh = await page.evaluate(() => window.innerHeight);
      console.log(`[log-form] Log button Y position: ${logBtnBox?.y}px / ${vh}px viewport = ${logBtnBox && logBtnBox.y < vh ? 'ABOVE FOLD ✓' : 'BELOW FOLD ✗'}`);
    }

    // Try nav to /log if there's a dedicated route
    await page.goto('/log').catch(() => {});
    await page.waitForTimeout(800);
    const url = page.url();
    console.log(`[log-form] /log route: ${url}`);
    await snap(page, '06-log-form', ti.project.name);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PATH AHEAD (week view)
// ────────────────────────────────────────────────────────────────────────────

test.describe('Path Ahead', () => {
  test('07 — path ahead page', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/path-ahead').catch(() => page.goto('/home'));
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);
    await snap(page, '07-path-ahead', ti.project.name);

    // Check for goal tracking widget
    const goalWidget = page.getByText(/goal|mat.*hours|hours.*goal|target/i).first();
    const hasGoal = await goalWidget.isVisible().catch(() => false);
    console.log(`[path-ahead] Goal tracking widget: ${hasGoal}`);

    // Check for tournament / competition section
    const compSection = page.getByText(/tournament|competition|compete/i).first();
    const hasComp = await compSection.isVisible().catch(() => false);
    console.log(`[path-ahead] Tournament/competition section: ${hasComp}`);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// FEATURE PRESENCE CHECKS
// ────────────────────────────────────────────────────────────────────────────

test.describe('Feature presence checks', () => {
  test('08 — PWA install prompt and offline banner', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Check for service worker / offline indicator
    const swRegistered = await page.evaluate(() =>
      'serviceWorker' in navigator && navigator.serviceWorker.controller !== null
    );
    console.log(`[pwa] Service worker active: ${swRegistered}`);

    // Check for offline banner (visible only when offline — just check the element exists)
    const offlineBanner = page.locator('[data-testid="offline-banner"], .offline-banner').first();
    const bannerExists = await offlineBanner.count() > 0;
    console.log(`[pwa] Offline banner element in DOM: ${bannerExists}`);
  });

  test('09 — eight gates streak milestone UI', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/home');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1500);

    // Check StatStrip for streak cell / gate glow
    const streakCell = page.locator('[data-testid="streak-cell"], .j2-streak-cell').first();
    const hasStreakCell = await streakCell.isVisible().catch(() => false);
    console.log(`[eight-gates] Streak cell visible: ${hasStreakCell}`);

    // Check for weekly consistency count in StatStrip (tap to flip)
    const statStrip = page.locator('[data-testid="stat-strip"]').first();
    if (await statStrip.isVisible().catch(() => false)) {
      await statStrip.click();
      await page.waitForTimeout(400);
      await snap(page, '09-stat-strip-flipped', ti.project.name);
    }
  });

  test('10 — session search (calendar)', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/calendar');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Try opening search panel
    const searchBtn = page.locator('button[aria-label*="search" i], button', { hasText: /search/i }).first();
    const hasSearch = await searchBtn.isVisible().catch(() => false);
    if (hasSearch) {
      await searchBtn.click();
      await page.waitForTimeout(600);
      await snap(page, '10-session-search-open', ti.project.name);
    } else {
      console.log(`[search] Search button not found`);
      await snap(page, '10-session-search-none', ti.project.name);
    }
  });

  test('11 — admin page (gate check)', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/admin');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    const url = page.url();
    console.log(`[admin] /admin redirects to: ${url}`);
    await snap(page, '11-admin', ti.project.name);
  });

  test('12 — push notification / reminder prompt', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/profile');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    const pushSection = page.getByText(/notification|reminder|push/i).first();
    const hasPush = await pushSection.isVisible().catch(() => false);
    console.log(`[push] Notification/reminder setting: ${hasPush}`);
  });

  test('13 — journal page', async ({ page }, ti) => {
    await auth(page);
    await page.goto('/journal');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);
    console.log(`[journal] /journal landed at: ${page.url()}`);
    await snap(page, '13-journal', ti.project.name);

    // Check for journal write button
    const journalBtn = page.locator('button, a', { hasText: /write|journal/i }).first();
    const hasJournal = await journalBtn.isVisible().catch(() => false);
    console.log(`[journal] Journal write button: ${hasJournal}`);
  });
});
