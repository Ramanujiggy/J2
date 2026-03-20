import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import authRoutes from './routes/authRoutes.js';
import sessionRoutes from './routes/sessionRoutes.js';
import profileRoutes from './routes/profileRoutes.js';
import intentionRoutes from './routes/intentionRoutes.js';
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

// ---- Auto-migration: ensure password_reset_tokens table exists --------------
async function runMigrations() {
    try {
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
        console.log('✅ Migrations complete');
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
app.use(express.json()); //allows the server to read json body content


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


// Catch-all JSON error handler — must be registered after all routes.
// Express 5 forwards async throws to error-handling middleware; without this
// the default handler sends an HTML page, which the frontend can't parse as JSON.
app.use((_err: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    console.error('❌ Unhandled error:', _err);
    res.status(500).json({ message: 'Server error' });
});

export { runMigrations };
export default app;