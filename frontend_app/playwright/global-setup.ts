// Global setup — registers (or finds) a dedicated E2E test user via the
// running backend, logs in, and persists the JWT into a Playwright storage
// state file at .auth/user.json. Every test then starts authenticated.
//
// Idempotent: if the user already exists from a previous run, the register
// call returns 409 and we skip straight to login.

import { request } from '@playwright/test';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const FRONTEND_ORIGIN = 'http://localhost:3000';
const BACKEND_BASE    = 'http://localhost:5000';

export const E2E_EMAIL    = 'playwright-e2e@journada-test.local';
export const E2E_PASSWORD = 'PlaywrightE2EPassword!2026';

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);
const STORAGE_PATH = path.resolve(__dirname, '.auth/user.json');

async function globalSetup() {
    // Reuse the cached token if it's still valid. The backend's auth rate limiter
    // (10 attempts / 15 min / IP) will brick us if we re-auth on every run.
    if (fs.existsSync(STORAGE_PATH)) {
        try {
            const stored = JSON.parse(await fs.promises.readFile(STORAGE_PATH, 'utf8'));
            const token = stored?.origins?.[0]?.localStorage?.find(
                (kv: { name: string }) => kv.name === 'token',
            )?.value as string | undefined;
            if (token) {
                const probe = await request.newContext({
                    baseURL: BACKEND_BASE,
                    extraHTTPHeaders: { Authorization: `Bearer ${token}` },
                });
                // /api/intentions/current is cheap, authenticated, and returns 200 even
                // when no intention is set. Failure means the token is stale.
                const r = await probe.get('/api/intentions/current?week_start=2099-01-01');
                await probe.dispose();
                if (r.status() === 200) return;
            }
        } catch { /* fall through to re-auth */ }
    }

    const api = await request.newContext({ baseURL: BACKEND_BASE });

    const reg = await api.post('/auth/register', {
        data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    // 409 = user already exists; 429 = rate-limited (assume user exists, try login).
    if (![201, 409, 429].includes(reg.status())) {
        throw new Error(`E2E register failed (${reg.status()}): ${await reg.text()}`);
    }

    const login = await api.post('/auth/login', {
        data: { email: E2E_EMAIL, password: E2E_PASSWORD },
    });
    if (!login.ok()) {
        throw new Error(`E2E login failed (${login.status()}): ${await login.text()}`);
    }
    const { token } = await login.json();
    if (!token) throw new Error('E2E login returned no token.');

    await fs.promises.mkdir(path.dirname(STORAGE_PATH), { recursive: true });
    await fs.promises.writeFile(
        STORAGE_PATH,
        JSON.stringify(
            {
                cookies: [],
                origins: [
                    {
                        origin: FRONTEND_ORIGIN,
                        localStorage: [{ name: 'token', value: token }],
                    },
                ],
            },
            null,
            2,
        ),
    );

    await api.dispose();
}

export default globalSetup;
