import { defineConfig, devices } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));

// CI end-to-end: the core capture journey against a real backend and an empty
// Postgres. Unlike playwright.config.ts (local, expects servers already up),
// this config starts both servers itself and needs only these env vars, which
// the `e2e` job in .github/workflows/ci.yml provides:
//   DATABASE_URL, DATABASE_SSL=false, JWT_SECRET, R2_* (placeholders are fine;
//   the journey uploads no footage).
// Locally: export the same vars, then `npx playwright test -c playwright/ci.config.ts`.
// PW_CHROMIUM_PATH points at a pre-installed Chromium when the bundled one
// isn't downloaded.

export default defineConfig({
    testDir: './ci',
    // Kept out of the tracked test-results/ that the local suite writes to.
    outputDir: './ci/.results',
    fullyParallel: false,
    workers: 1,
    forbidOnly: !!process.env.CI,
    retries: process.env.CI ? 1 : 0,
    reporter: process.env.CI ? [['list'], ['html', { open: 'never', outputFolder: './ci/.report' }]] : [['list']],
    timeout: 60_000,
    expect: { timeout: 10_000 },
    use: {
        baseURL: 'http://localhost:4173',
        trace: 'retain-on-failure',
        screenshot: 'only-on-failure',
        ...(process.env.PW_CHROMIUM_PATH
            ? { launchOptions: { executablePath: process.env.PW_CHROMIUM_PATH } }
            : {}),
    },
    projects: [
        { name: 'mobile', use: { ...devices['Pixel 7'] } },
    ],
    webServer: [
        {
            command: 'npx tsx src/server.ts',
            cwd: path.resolve(here, '../../backend_api'),
            // Any response means it's listening (401 here); the spec waits for migrations.
            url: 'http://localhost:5000/api/sessions',
            reuseExistingServer: !process.env.CI,
            timeout: 120_000,
            env: { PORT: '5000', FRONTEND_URL: 'http://localhost:4173', ALLOWED_ORIGIN: 'http://localhost:4173' },
        },
        {
            // The production build, not the dev server: Vite's dev server
            // re-optimises dependencies on first visit to a lazy route and
            // reloads the page mid-test. Preview reuses server.proxy for /api.
            command: 'npx vite build && npx vite preview --port 4173 --strictPort',
            cwd: path.resolve(here, '..'),
            // Never the production API: .env.production bakes the Railway URL
            // into a build, and process env wins over it. Same-origin here, so
            // preview's proxy sends /api and /auth to the local backend.
            env: { VITE_API_BASE_URL: 'http://localhost:4173' },
            url: 'http://localhost:4173',
            reuseExistingServer: !process.env.CI,
            timeout: 300_000,
        },
    ],
});
