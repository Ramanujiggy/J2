/**
 * Playwright config for running against the live Railway deployment.
 * No local web server — just points at the remote URL.
 *
 * Auth happens once in the `setup` project (roadmap-audit.setup.ts) and is
 * shared via storageState — prod rate-limits /auth/* to 10 req / 15 min.
 *
 * Usage:
 *   npx playwright test --config=e2e/playwright-remote.config.ts e2e/roadmap-audit.spec.ts
 */
import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const AUDIT_STATE = path.join(__dirname, '.auth', 'audit-state.json');

export default defineConfig({
  testDir: '../e2e',
  outputDir: '../e2e/test-results',
  workers: 1,
  reporter: [['line'], ['html', { outputFolder: '../e2e/playwright-report-remote', open: 'never' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'https://extraordinary-freedom-production.up.railway.app',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    actionTimeout: 15_000,
    navigationTimeout: 30_000,
  },

  projects: [
    {
      name: 'setup',
      testMatch: /roadmap-audit\.setup\.ts/,
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'], storageState: AUDIT_STATE },
      dependencies: ['setup'],
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'], storageState: AUDIT_STATE },
      dependencies: ['setup'],
    },
  ],
});
