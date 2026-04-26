import { defineConfig, devices } from '@playwright/test';

// E2E suite for the chip-input flow. Assumes frontend dev server (Vite on :3000)
// and backend dev server (Express on :5000) are already running locally — does
// NOT auto-start them, since boot order needs the migration runner to settle
// against a real DB. Start manually: `npm run dev` in each of frontend_app/
// and backend_api/.

export default defineConfig({
    testDir: './playwright/tests',
    globalSetup: './playwright/global-setup.ts',
    fullyParallel: false,        // single shared test user; serialise to avoid races
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: [['list']],
    timeout: 30_000,
    expect: { timeout: 5_000 },
    use: {
        baseURL: 'http://localhost:3000',
        storageState: './playwright/.auth/user.json',
        trace: 'on-first-retry',
        actionTimeout: 5_000,
        navigationTimeout: 10_000,
    },
    projects: [
        { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    ],
});
