# Build Structure — Journada CRUD App Skeleton

A portable reference for spinning up a new full-stack CRUD app using the same architecture as this project. Copy the structure, swap in your domain, and the boilerplate decisions are already made.

---

## Stack Choices

| Layer | Choice | Why |
|---|---|---|
| **Backend runtime** | Node.js + TypeScript | Familiar, fast to iterate, large ecosystem |
| **Web framework** | Express 5 | Minimal, async-native in v5, no opinions on structure |
| **Module format** | ESM (`"type": "module"`) | Native Node ESM; matches `module: nodenext` in tsconfig |
| **Database client** | `pg` pool (raw SQL) | No ORM magic — queries are explicit, easy to optimise, easy to test |
| **Auth** | JWT (24h) + bcrypt (12 rounds) | Stateless, no session store needed for single-service apps |
| **Email** | Nodemailer (Ethereal in dev, SMTP in prod) | Zero-config dev fallback; same code in both envs |
| **Validation** | Zod (profile/complex shapes) + manual (controller-level) | Zod for nested objects; inline checks for simple fields |
| **Test framework** | Vitest | Native ESM support; Jest needs painful transform config for ESM+TypeScript |
| **Frontend scaffold** | Vite + React 18 + TypeScript | Fast HMR, first-class TypeScript, no CRA overhead |
| **UI primitives** | Tailwind CSS + Radix UI + shadcn/ui | Utility-first styling; accessible headless components; shadcn owns the source |
| **Hosting** | Railway (two separate services) | One platform for both services; env vars per service; easy rollback |

---

## Directory Skeleton

```
repo-root/
├── package.json          ← workspace root (husky only — no app code)
├── .husky/
│   └── pre-commit        ← runs backend tests before every commit
├── backend_api/
│   ├── package.json
│   ├── tsconfig.json
│   ├── railway.toml
│   ├── vitest.config.ts
│   └── src/
│       ├── app.ts        ← Express setup ONLY — no listen(), exports app
│       ├── server.ts     ← calls app.listen() + runMigrations()
│       ├── config/
│       │   └── db.ts     ← pg pool + query() helper
│       ├── middleware/
│       │   └── authMiddleware.ts   ← verifyToken (JWT)
│       ├── controllers/  ← validate input → call models → return response
│       ├── models/       ← SQL queries ONLY — no validation or business logic
│       ├── routes/       ← map HTTP verbs to controllers
│       ├── services/     ← side effects (email, 3rd-party APIs)
│       └── migrations/   ← SQL files; auto-run via runMigrations() in server.ts
│   └── tests/
│       ├── auth.test.ts
│       ├── sessions.test.ts
│       └── middleware.test.ts
└── frontend_app/
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts
    ├── tailwind.config.ts
    └── src/
        ├── main.tsx
        ├── App.tsx       ← router + ProtectedShell wrapper
        ├── app/          ← pages (one file per route)
        ├── components/   ← reusable UI components
        ├── context/      ← AuthContext, ProfileContext (and any domain contexts)
        ├── hooks/        ← useAuth, use-toast, any custom hooks
        └── lib/
            ├── api.ts    ← fetch wrapper (JWT injection + 401 handler)
            ├── theme.ts  ← ALL color/shadow tokens — never hardcode in components
            ├── constants.ts
            └── utils.ts  ← cn() and other one-liners
```

---

## Backend Bootstrap Sequence

Follow in order when starting a new backend from scratch.

1. **Init package.json**
   ```bash
   npm init -y
   # Manually set: "type": "module"
   ```

2. **Install dependencies**
   ```bash
   # Runtime
   npm install express@5 dotenv helmet cors express-rate-limit bcrypt jsonwebtoken pg nodemailer zod

   # Dev
   npm install -D typescript tsx @types/node @types/express @types/bcrypt @types/cors @types/jsonwebtoken @types/pg @types/nodemailer vitest @vitest/coverage-v8 supertest @types/supertest
   ```

3. **`tsconfig.json`** — key settings:
   ```json
   {
     "compilerOptions": {
       "module": "nodenext",
       "target": "esnext",
       "rootDir": "./src",
       "outDir": "./dist",
       "strict": true,
       "verbatimModuleSyntax": true,
       "isolatedModules": true,
       "skipLibCheck": true
     }
   }
   ```
   > `module: nodenext` requires `.js` extensions on all relative imports in source files (even though the files are `.ts`). This is correct and intentional.

4. **`src/config/db.ts`** — pg pool with query helper (see pattern below)

5. **`src/app.ts`** — Express setup only; exports `app` and `runMigrations`; no `app.listen()` call (see pattern below)

6. **`src/server.ts`** — imports `app`, calls `app.listen()`, calls `runMigrations()`

7. **`src/middleware/authMiddleware.ts`** — `verifyToken` (see pattern below)

8. **Auth routes** — `POST /auth/register`, `POST /auth/login`, password reset flow

9. **First protected resource** — apply `verifyToken` middleware, write controller + model

10. **`vitest.config.ts`** — set `NODE_ENV`, `JWT_SECRET`, `DATABASE_URL` in test env (see pattern below)

11. **First test file** — mock `db.ts`, write controller tests with supertest

12. **`railway.toml`**:
    ```toml
    [build]
    buildCommand = "npm install && npm run build"

    [deploy]
    startCommand = "npm run start"
    healthcheckPath = "/"
    ```

---

## Frontend Bootstrap Sequence

1. **Scaffold**
   ```bash
   npm create vite@latest frontend_app -- --template react-ts
   ```

2. **Install UI dependencies**
   ```bash
   npm install tailwindcss @radix-ui/react-slot @radix-ui/react-toast @radix-ui/react-tooltip @radix-ui/react-select lucide-react clsx tailwind-merge class-variance-authority
   npm install react-router-dom
   ```

3. **Configure Tailwind** — `tailwind.config.ts` with custom brand color tokens

4. **`vite.config.ts`** — add dev proxy so `/auth` and `/api` route to `localhost:5000` (no CORS issues in dev):
   ```typescript
   server: {
     port: 3000,
     proxy: {
       '/auth': 'http://localhost:5000',
       '/api':  'http://localhost:5000',
     },
   }
   ```

5. **`src/lib/theme.ts`** — define ALL color tokens here first; nothing gets hardcoded in components

6. **`src/lib/api.ts`** — fetch wrapper with JWT injection and global 401 handler (see pattern below)

7. **`src/context/AuthContext.tsx`** — JWT state + localStorage + auto-logout on 401

8. **`src/App.tsx`** — router + `ProtectedShell` component that reads `isAuthenticated` and redirects

9. **First page + protected route**

---

## Key Patterns

### `src/config/db.ts` — pg pool + query helper
```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';
dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
});

export const query = (text: string, params?: unknown[]) => pool.query(text, params);
export default pool;
```

---

### `src/app.ts` — Express config only (no listen)
```typescript
import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { query } from './config/db.js';
// ... import routes

const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) { console.error('Missing env:', missing); process.exit(1); }

export async function runMigrations() {
  await query(`CREATE TABLE IF NOT EXISTS ...`);
}

const app = express();
app.use(helmet());
app.use(cors({ origin: process.env.ALLOWED_ORIGIN ?? '*' }));
app.use(express.json());

app.get('/', async (_req, res) => {
  try { await query('SELECT 1'); res.json({ status: 'ok', db: 'connected' }); }
  catch { res.status(500).json({ status: 'error', db: 'disconnected' }); }
});

app.use('/auth', authRoutes);
app.use('/api', protectedRoutes);

// Catch-all error handler — required for Express 5 async error propagation
app.use((_err, _req, res, _next) => {
  res.status(500).json({ message: 'Server error' });
});

export default app;
```

---

### `src/server.ts` — entry point
```typescript
import app, { runMigrations } from './app.js';
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server on http://localhost:${PORT}`);
  await runMigrations();
});
```
> This split is what makes the Express app importable in tests without starting a server.

---

### `src/middleware/authMiddleware.ts` — verifyToken
```typescript
import jwt from 'jsonwebtoken';
import type { Request, Response, NextFunction } from 'express';

interface TokenPayload { id: string; email: string; }

declare global {
  namespace Express { interface Request { user?: TokenPayload; } }
}

export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
  const header = req.headers.authorization;
  if (!header?.startsWith('Bearer ')) { res.status(401).json({ message: 'No token provided.' }); return; }
  try {
    req.user = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET!) as TokenPayload;
    next();
  } catch (e) {
    if (e instanceof jwt.TokenExpiredError) { res.status(401).json({ message: 'Token expired.' }); return; }
    res.status(401).json({ message: 'Invalid token.' });
  }
};
```

---

### Rate limiter with test bypass
```typescript
import rateLimit from 'express-rate-limit';

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { message: 'Too many attempts. Try again in 15 minutes.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: () => process.env.NODE_ENV === 'test',  // ← critical for test suite
});
```

---

### Controller/model split — rules
- **Controller** (`controllers/`): parse request, validate all inputs, call model functions, return response. Never write SQL here.
- **Model** (`models/`): SQL queries only. Accept typed arguments, return typed results. No validation, no HTTP concepts.
- **Why:** Controllers are tested via supertest with mocked models. Models can be tested independently with a real test DB if needed later.

---

### `vitest.config.ts` — test isolation
```typescript
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    env: {
      DATABASE_URL: 'postgresql://test:test@localhost/test', // fake — db is mocked
      JWT_SECRET: 'test-secret-for-vitest',
      NODE_ENV: 'test',  // disables rate limiter
    },
  },
});
```

---

### Vitest mock pattern — DB isolation
```typescript
// Hoisted — prevents db.ts connection test from running on import
vi.mock('../src/config/db.js', () => ({
  query: vi.fn(),
  default: { connect: vi.fn() },
}));

// Mock the model layer so controllers can be tested without a real DB
vi.mock('../src/models/userModel.js', () => ({
  findUserByEmail: vi.fn(),
  createUser: vi.fn(),
}));

import app from '../src/app.js';  // safe to import after mocks are hoisted
import * as userModel from '../src/models/userModel.js';

// In tests:
vi.mocked(userModel.findUserByEmail).mockResolvedValue(null);
```

---

### `src/lib/api.ts` — frontend fetch wrapper
```typescript
const BASE = import.meta.env.VITE_API_BASE_URL ?? '';

let onAuthError: (() => void) | null = null;
export const setAuthErrorHandler = (fn: () => void) => { onAuthError = fn; };

class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

async function request(method: string, path: string, body?: unknown) {
  const token = localStorage.getItem('token');
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401) { onAuthError?.(); }
  if (!res.ok) {
    const { message } = await res.json().catch(() => ({ message: res.statusText }));
    throw new ApiError(res.status, message);
  }
  return res.json();
}

export const api = {
  get:    (path: string) => request('GET', path),
  post:   (path: string, body: unknown) => request('POST', path, body),
  put:    (path: string, body: unknown) => request('PUT', path, body),
  patch:  (path: string, body: unknown) => request('PATCH', path, body),
  delete: (path: string) => request('DELETE', path),
};
```

---

## Environment Variables

### Backend `.env`
```
DATABASE_URL=postgresql://user:pass@host:5432/dbname
JWT_SECRET=<long-random-string>

# Optional
PORT=5000
ALLOWED_ORIGIN=https://your-frontend.railway.app
FRONTEND_URL=https://your-frontend.railway.app
SMTP_HOST=smtp.example.com
SMTP_PORT=587
SMTP_USER=noreply@example.com
SMTP_PASS=
SMTP_FROM=AppName <noreply@example.com>
```

### Frontend `.env.production`
```
VITE_API_BASE_URL=https://your-backend.railway.app
VITE_GOOGLE_MAPS_API_KEY=   # optional
```
> `VITE_*` vars are baked into the bundle at build time. Set them in Railway before deploying.

---

## Git & Tooling Setup

### Root `package.json` (husky only — not part of the app)
```json
{
  "name": "your-app-name",
  "private": true,
  "scripts": { "prepare": "husky" },
  "devDependencies": { "husky": "^9.x.x" }
}
```

### Install and configure
```bash
# From repo root
npm install           # installs husky, runs prepare → activates hooks
npx husky init        # creates .husky/pre-commit with default content
# Edit .husky/pre-commit:
echo "cd backend_api && npm test" > .husky/pre-commit
```

### `.husky/pre-commit`
```sh
cd backend_api && npm test
```

The `prepare` script means anyone who clones the repo and runs `npm install` at the root automatically gets the hook installed. No manual `.git/hooks/` setup.

---

## Railway Deployment Checklist

### Backend service
- [ ] Set `DATABASE_URL` (Supabase or Railway Postgres add-on)
- [ ] Set `JWT_SECRET` (generate with `openssl rand -hex 32`)
- [ ] Set `ALLOWED_ORIGIN` to the frontend Railway URL
- [ ] Set `FRONTEND_URL` to the frontend Railway URL (for password reset links)
- [ ] Set SMTP vars if sending real email; omit for Ethereal dev fallback
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npm run start` (runs `node dist/server.js`)
- [ ] Health check path: `/`

### Frontend service
- [ ] Set `VITE_API_BASE_URL` to the backend Railway URL **before triggering a build**
- [ ] Build command: `npm install && npm run build`
- [ ] Start command: `npx serve dist -s` (SPA fallback)

---

## Spin-Up Checklist

Use this when starting a new project from scratch.

**Repo setup**
- [ ] Create git repo, clone locally
- [ ] Create root `package.json` + install husky
- [ ] Create `.husky/pre-commit` pointing at backend tests
- [ ] Create `backend_api/` and `frontend_app/` directories

**Backend**
- [ ] `npm init` in `backend_api/`, set `"type": "module"`
- [ ] Install all deps (see Bootstrap Sequence step 2)
- [ ] Copy `tsconfig.json` skeleton
- [ ] Write `config/db.ts`
- [ ] Write `app.ts` (no listen) + `server.ts` (listen + migrations)
- [ ] Write `authMiddleware.ts`
- [ ] Create users table in DB
- [ ] Implement register + login + JWT
- [ ] Add first protected resource (model + controller + route)
- [ ] Write `vitest.config.ts`
- [ ] Write first test file; confirm `npm test` passes
- [ ] Write `railway.toml`

**Frontend**
- [ ] Scaffold with Vite (`npm create vite@latest`)
- [ ] Install UI deps (Tailwind, Radix, shadcn, React Router)
- [ ] Write `lib/theme.ts` with brand tokens
- [ ] Write `lib/api.ts` fetch wrapper
- [ ] Write `AuthContext`
- [ ] Write `App.tsx` router + `ProtectedShell`
- [ ] First page (login) → confirm auth flow end-to-end
- [ ] Add `.env.production` with `VITE_API_BASE_URL`

**Deploy**
- [ ] Push to GitHub
- [ ] Create Railway project, link repo
- [ ] Add backend service — set all env vars — deploy
- [ ] Confirm health check at `/` returns `{ status: "ok" }`
- [ ] Add frontend service — set `VITE_API_BASE_URL` — deploy
- [ ] Set `ALLOWED_ORIGIN` on backend to frontend URL — redeploy backend
- [ ] End-to-end smoke test: register → login → create a resource
