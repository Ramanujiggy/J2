import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import intentionRoutes from './routes/intentionRoutes.js';
import userTagRoutes from './routes/userTagRoutes.js';
import canonicalPositionRoutes from './routes/canonicalPositionRoutes.js';
import canonicalConstraintRoutes from './routes/canonicalConstraintRoutes.js';
import userConstraintRoutes from './routes/userConstraintRoutes.js';
// db import triggers pool connection test on startup
import { query } from './config/db.js';

dotenv.config();

// ---- Startup: validate required env vars ------------------------------------
const REQUIRED_ENV = ['DATABASE_URL', 'JWT_SECRET'] as const;
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`);
    console.error('Set these in your Railway service environment variables and redeploy.');
    process.exit(1);
}

if (!process.env.FRONTEND_URL) {
    console.warn('⚠️  FRONTEND_URL is not set — password reset email links will point to http://localhost:3000. Set FRONTEND_URL=https://<your-frontend>.up.railway.app in the backend service env vars.');
}

// ---- Auto-migration system ──────────────────────────────────────────────────
// Runs numbered SQL files from /migrations/ in order, tracking applied state
// in a schema_migrations table. Also ensures password_reset_tokens exists
// (legacy inline migration kept for backward compatibility).

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '..', 'migrations');

async function runMigrations() {
    try {
        // Legacy: ensure password_reset_tokens exists (was inline before migration system)
        await query(`
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token      TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL,
                used       BOOLEAN NOT NULL DEFAULT false,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);
        await query(`
            CREATE INDEX IF NOT EXISTS idx_password_reset_tokens_token
            ON password_reset_tokens(token)
        `);

        // Version tracking table
        await query(`
            CREATE TABLE IF NOT EXISTS schema_migrations (
                name       TEXT PRIMARY KEY,
                applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
        `);

        // Seed: if the DB already has columns from earlier manual migrations (001-005),
        // mark them as applied to avoid re-running. Uses ON CONFLICT DO NOTHING so
        // this is safe to run repeatedly (handles partial seeds from interrupted starts).
        const check = await query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_name = 'training_sessions' AND column_name = 'heading'
        `);
        if (check.rows.length > 0) {
            const legacy = [
                '001_add_weekly_intentions.sql',
                '002_add_intention_duration.sql',
                '003_add_journal_entry.sql',
                '004_add_intentions_enabled.sql',
                '005_dynamic_pillar_engine.sql',
            ];
            for (const name of legacy) {
                await query('INSERT INTO schema_migrations (name) VALUES ($1) ON CONFLICT DO NOTHING', [name]);
            }
        }

        // Find and run numbered migrations
        if (!fs.existsSync(MIGRATIONS_DIR)) {
            console.log('✅ Migrations complete (no migrations directory)');
            return;
        }

        const files = fs.readdirSync(MIGRATIONS_DIR)
            .filter(f => f.endsWith('.sql'))
            .sort(); // lexicographic sort ensures 001 < 002 < ... < 006

        const applied = await query('SELECT name FROM schema_migrations');
        const appliedSet = new Set(applied.rows.map((r: { name: string }) => r.name));

        let newCount = 0;
        for (const file of files) {
            if (appliedSet.has(file)) continue;
            const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf-8');
            await query(sql);
            await query('INSERT INTO schema_migrations (name) VALUES ($1)', [file]);
            console.log(`  ✅ Applied migration: ${file}`);
            newCount++;
        }

        console.log(newCount > 0
            ? `✅ Migrations complete (${newCount} new)`
            : '✅ Migrations complete (all up to date)');
    } catch (err) {
        console.error('❌ Migration failed:', err);
    }
}

const app = express();


//security middleware
app.use(helmet());
const corsOptions: cors.CorsOptions = {
  origin: process.env.ALLOWED_ORIGIN ?? '*',
  credentials: !!process.env.ALLOWED_ORIGIN,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));
app.options('/{*path}', cors(corsOptions)); // respond to preflight for every route
app.use(express.json({ limit: '5mb' })); // raised from default 100KB to support bulk session imports


// Health check — visit https://<backend>.railway.app/ to confirm the backend is alive
app.get('/', async (_req, res) => {
    try {
        await query('SELECT 1');
        res.json({ status: 'ok', db: 'connected' });
    } catch (err) {
        res.status(500).json({ status: 'error', db: 'disconnected', detail: String(err) });
    }
});

// auth routes: POST /auth/register, POST /auth/login
app.use('/auth', authRoutes);

// session routes: POST /api/sessions, GET /api/sessions
app.use('/api', sessionRoutes);

// profile routes: GET /api/profile, PUT /api/profile
app.use('/api', profileRoutes);

// intention routes: POST/GET /api/intentions, GET /api/intentions/current, DELETE /api/intentions/:id
app.use('/api/intentions', intentionRoutes);
app.use('/api/user-tags', userTagRoutes);
app.use('/api/canonical-positions', canonicalPositionRoutes);
app.use('/api/canonical-constraints', canonicalConstraintRoutes);
app.use('/api/user-constraints', userConstraintRoutes);


// Catch-all JSON error handler — must be registered after all routes.
// Express 5 forwards async throws to error-handling middleware; without this
// the default handler sends an HTML page, which the frontend can't parse as JSON.
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Unhandled error:', _err);
    res.status(500).json({ message: 'Server error' });
});

export { runMigrations };
export default app;