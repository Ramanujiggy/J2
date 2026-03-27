import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';

const rootDir = __dirname;

export default defineConfig({
  testDir: './e2e',
  outputDir: './e2e/test-results',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { outputFolder: './e2e/playwright-report' }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? 'http://localhost:4173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    {
      name: 'desktop-chrome',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'mobile-chrome',
      use: { ...devices['Pixel 7'] },
    },
    {
      name: 'mobile-safari',
      use: { ...devices['iPhone 14'] },
    },
  ],

  webServer: [
    {
      command: 'npm run dev',
      cwd: path.join(rootDir, 'backend_api'),
      port: 5000,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
    {
      command: 'npm run dev -- --port 4173',
      cwd: path.join(rootDir, 'frontend_app'),
      port: 4173,
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],
});
