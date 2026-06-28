// adminController — admin-only dashboard endpoints. All routes mounted at
// /api/admin/* are gated by verifyToken + requireAdmin (see adminRoutes).

import type { Request, Response } from 'express';
import { z } from 'zod';
import fsSync from 'node:fs';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { query } from '../config/db.js';
import { listCases, updateCase } from '../models/supportCaseModel.js';
import { listAllObjects, deleteObject } from '../lib/r2Client.js';
import { getRouteManifest } from '../lib/routeManifest.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ARCHITECTURE_MANIFEST_PATH = path.resolve(__dirname, '..', '..', 'data', 'architecture-manifest.json');

// ── GET /api/admin/stats ──────────────────────────────────────────────────
// Single-row aggregate. Cheap enough to run on every dashboard load.
export const getStats = async (_req: Request, res: Response): Promise<void> => {
    try {
        // Test-user predicate (mirrored on the frontend filter logic): emails
        // ending in @journada-e2e.com OR @example.com count as test users.
        // The dashboard subtracts these from displayed totals when the
        // "Show test users" toggle is off.
        const testWhere = `(email LIKE '%@journada-e2e.com' OR email LIKE '%@example.com')`;

        const result = await query(`
            SELECT
              (SELECT COUNT(*) FROM users)                                                                  AS total_users,
              (SELECT COUNT(*) FROM users             WHERE created_at > NOW() - INTERVAL '24 hours')       AS users_24h,
              (SELECT COUNT(*) FROM users             WHERE created_at > NOW() - INTERVAL '7 days')         AS users_7d,
              (SELECT COUNT(*) FROM users             WHERE ${testWhere})                                   AS test_users,
              (SELECT COUNT(*) FROM users             WHERE ${testWhere} AND created_at > NOW() - INTERVAL '24 hours')  AS test_users_24h,
              (SELECT COUNT(*) FROM users             WHERE ${testWhere} AND created_at > NOW() - INTERVAL '7 days')    AS test_users_7d,
              (SELECT COUNT(*) FROM training_sessions)                                                      AS total_sessions,
              (SELECT COUNT(*) FROM training_sessions WHERE created_at > NOW() - INTERVAL '24 hours')       AS sessions_24h,
              (SELECT COUNT(*) FROM training_sessions WHERE created_at > NOW() - INTERVAL '7 days')         AS sessions_7d,
              (SELECT COUNT(*) FROM support_cases     WHERE status = 'open')                                AS cases_open,
              (SELECT COUNT(*) FROM support_cases     WHERE status = 'in_progress')                         AS cases_in_progress
        `);
        const r = result.rows[0] as {
            total_users: string;
            users_24h: string;
            users_7d: string;
            test_users: string;
            test_users_24h: string;
            test_users_7d: string;
            total_sessions: string;
            sessions_24h: string;
            sessions_7d: string;
            cases_open: string;
            cases_in_progress: string;
        };
        // pg returns COUNT() as string — coerce to number for the client.
        res.json({
            stats: {
                total_users:       Number(r.total_users),
                users_24h:         Number(r.users_24h),
                users_7d:          Number(r.users_7d),
                test_user_count:    Number(r.test_users),
                test_users_24h:     Number(r.test_users_24h),
                test_users_7d:      Number(r.test_users_7d),
                total_sessions:    Number(r.total_sessions),
                sessions_24h:      Number(r.sessions_24h),
                sessions_7d:       Number(r.sessions_7d),
                cases_open:        Number(r.cases_open),
                cases_in_progress: Number(r.cases_in_progress),
            },
        });
    } catch (err) {
        console.error('❌ Error fetching admin stats:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ── GET /api/admin/cases?status=... ───────────────────────────────────────
const StatusFilter = z.enum(['open', 'in_progress', 'closed']).optional();

export const getCases = async (req: Request, res: Response): Promise<void> => {
    try {
        const parsed = StatusFilter.safeParse(req.query.status);
        if (!parsed.success) {
            res.status(400).json({ message: 'Invalid status filter.' });
            return;
        }
        const cases = await listCases(parsed.data);
        res.json({ cases });
    } catch (err) {
        console.error('❌ Error listing support cases:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ── PATCH /api/admin/cases/:id ────────────────────────────────────────────
const UpdateCaseSchema = z.object({
    status:      z.enum(['open', 'in_progress', 'closed']).optional(),
    severity:    z.enum(['low', 'normal', 'high', 'urgent']).optional(),
    admin_notes: z.string().max(5000).nullable().optional(),
});

export const patchCase = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        if (!id) {
            res.status(400).json({ message: 'Missing case id.' });
            return;
        }
        const parsed = UpdateCaseSchema.safeParse(req.body);
        if (!parsed.success) {
            res.status(400).json({ message: 'Invalid update.', errors: parsed.error.flatten() });
            return;
        }
        // Build the update payload by stripping undefined keys so the
        // exactOptionalPropertyTypes check passes — UpdateCaseInput's optional
        // fields don't accept explicit undefined.
        const update: Parameters<typeof updateCase>[1] = {};
        if (parsed.data.status      !== undefined) update.status      = parsed.data.status;
        if (parsed.data.severity    !== undefined) update.severity    = parsed.data.severity;
        if (parsed.data.admin_notes !== undefined) update.admin_notes = parsed.data.admin_notes;
        const updated = await updateCase(id, update);
        if (!updated) {
            res.status(404).json({ message: 'Case not found.' });
            return;
        }
        res.json({ case: updated });
    } catch (err) {
        console.error('❌ Error updating support case:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ── GET /api/admin/users/:id ──────────────────────────────────────────────
// Detail view for a single user — used by /admin/users/:id on the frontend.
// Single round-trip: profile + activity stats + recent sessions + recent
// intentions + that user's support cases. No edit affordances in v1.
export const getUserDetail = async (req: Request, res: Response): Promise<void> => {
    try {
        const id = req.params.id;
        if (!id) {
            res.status(400).json({ message: 'Missing user id.' });
            return;
        }

        // 1. Profile + computed activity stats in one query.
        const profileResult = await query(`
            SELECT
              u.id,
              u.email,
              u.name,
              u.belt_rank,
              u.stripes,
              u.home_gym_name,
              u.home_gym_address,
              u.timezone,
              u.intentions_enabled,
              u.is_admin,
              u.onboarding_completed_at,
              u.created_at,
              u.last_login_at,
              COALESCE(s.total_sessions, 0)::int  AS total_sessions,
              COALESCE(s.total_minutes, 0)::int   AS total_minutes,
              s.last_session_at,
              COALESCE(s.sessions_7d, 0)::int     AS sessions_7d
            FROM users u
            LEFT JOIN (
              SELECT
                user_id,
                COUNT(*)                                                                 AS total_sessions,
                SUM(duration)                                                            AS total_minutes,
                MAX(created_at)                                                          AS last_session_at,
                COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')           AS sessions_7d
              FROM training_sessions
              WHERE user_id = $1
              GROUP BY user_id
            ) s ON s.user_id = u.id
            WHERE u.id = $1
        `, [id]);

        if (profileResult.rows.length === 0) {
            res.status(404).json({ message: 'User not found.' });
            return;
        }
        const u = profileResult.rows[0] as Record<string, unknown>;

        // 2. Last 20 sessions for the user.
        const sessionsResult = await query(`
            SELECT id, date, duration, intensity, gi_nogi, session_type, heading, notes
            FROM training_sessions
            WHERE user_id = $1
            ORDER BY date DESC, created_at DESC
            LIMIT 20
        `, [id]);

        // 3. Last 5 intentions.
        const intentionsResult = await query(`
            SELECT id, week_start, intent_label, heading, duration_days, journal_entry, created_at
            FROM weekly_intentions
            WHERE user_id = $1
            ORDER BY week_start DESC
            LIMIT 5
        `, [id]);

        // 4. All support cases this user filed.
        const casesResult = await query(`
            SELECT id, status, severity, subject, description,
                   page_url, user_agent, app_version,
                   admin_notes, created_at, updated_at, closed_at
            FROM support_cases
            WHERE user_id = $1
            ORDER BY created_at DESC
        `, [id]);

        res.json({
            user: {
                id:                       u.id,
                email:                    u.email,
                name:                     u.name,
                belt_rank:                u.belt_rank,
                stripes:                  u.stripes,
                home_gym_name:            u.home_gym_name,
                home_gym_address:         u.home_gym_address,
                timezone:                 u.timezone,
                intentions_enabled:       u.intentions_enabled,
                is_admin:                 u.is_admin,
                onboarding_completed_at:  u.onboarding_completed_at,
                created_at:               u.created_at,
                last_login_at:            u.last_login_at ?? null,
            },
            stats: {
                total_sessions:   Number(u.total_sessions),
                total_minutes:    Number(u.total_minutes),
                last_session_at:  u.last_session_at ?? null,
                sessions_7d:      Number(u.sessions_7d),
            },
            recent_sessions:    sessionsResult.rows,
            recent_intentions:  intentionsResult.rows,
            cases:              casesResult.rows,
        });
    } catch (err) {
        console.error('❌ Error fetching user detail:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ── GET /api/admin/users ──────────────────────────────────────────────────
// Recent users + their session counts. Useful for spot-checking activity.
export const getUsers = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await query(`
            SELECT
              u.id,
              u.email,
              u.name,
              u.belt_rank,
              u.created_at,
              u.last_login_at,
              COUNT(s.id)::text                AS session_count,
              MAX(s.created_at)                AS last_session_at
            FROM users u
            LEFT JOIN training_sessions s ON s.user_id = u.id
            GROUP BY u.id
            ORDER BY u.created_at DESC
            LIMIT 50
        `);
        const rows = result.rows as Array<{
            id: string;
            email: string;
            name: string | null;
            belt_rank: string | null;
            created_at: string;
            last_login_at: string | null;
            session_count: string;
            last_session_at: string | null;
        }>;
        res.json({
            users: rows.map(u => ({
                id:              u.id,
                email:           u.email,
                name:            u.name,
                belt_rank:       u.belt_rank,
                created_at:      u.created_at,
                last_login_at:   u.last_login_at,
                session_count:   Number(u.session_count),
                last_session_at: u.last_session_at,
            })),
        });
    } catch (err) {
        console.error('❌ Error listing users:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const getRecentLogins = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await query(`
            SELECT id, email, name, belt_rank, last_login_at
            FROM users
            WHERE last_login_at IS NOT NULL
            ORDER BY last_login_at DESC
            LIMIT 20
        `);
        res.json({ logins: result.rows });
    } catch (err) {
        console.error('❌ Error listing recent logins:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

// ── POST /api/admin/cleanup-orphaned-videos ───────────────────────────────
//
// Walks the R2 bucket, joins each object key against the storage keys
// claimed by `user_tags` rows (video_storage_key OR video_raw_storage_key),
// and reports any object not referenced by a tag as an orphan.
//
// These orphans typically come from broken upload sessions: the PUT to R2
// succeeded (so bytes landed in the bucket) but the subsequent
// `/upload-complete` call failed before the DB row was updated. The result
// is bytes in R2 that no DB row knows about.
//
// Modes:
//   • Default (dry-run) — returns the orphan list + total bytes, deletes
//     nothing. Safe to run anytime.
//   • `?execute=true` — also deletes the orphans from R2. Idempotent;
//     re-running yields fewer/zero orphans.
//
// Response shape:
//   {
//     mode: 'dry-run' | 'execute',
//     scanned: number,         // total R2 objects walked
//     claimed: number,         // distinct storage keys referenced by tags
//     orphans: Array<{ key, sizeBytes }>,
//     totalOrphanedBytes: number,
//     deleted: number,         // 0 in dry-run
//     errors: Array<{ key, message }>
//   }
export const cleanupOrphanedVideos = async (req: Request, res: Response): Promise<void> => {
    try {
        const execute = req.query.execute === 'true';

        // Pull every storage key currently claimed by a user_tags row, from
        // either the encoded slot or the (transient) raw slot. UNION
        // dedupes; we want the set of "in-use" keys.
        const claimResult = await query(`
            SELECT video_storage_key AS key FROM user_tags
             WHERE video_storage_key IS NOT NULL
            UNION
            SELECT video_raw_storage_key AS key FROM user_tags
             WHERE video_raw_storage_key IS NOT NULL
        `);
        const claimedKeys = new Set<string>(
            (claimResult.rows as Array<{ key: string }>).map(r => r.key),
        );

        const allObjects = await listAllObjects();

        const orphans: Array<{ key: string; sizeBytes: number }> = [];
        for (const obj of allObjects) {
            if (!claimedKeys.has(obj.key)) {
                orphans.push(obj);
            }
        }
        const totalOrphanedBytes = orphans.reduce((sum, o) => sum + o.sizeBytes, 0);

        let deleted = 0;
        const errors: Array<{ key: string; message: string }> = [];
        if (execute) {
            for (const orphan of orphans) {
                try {
                    await deleteObject(orphan.key);
                    deleted++;
                } catch (err) {
                    errors.push({
                        key: orphan.key,
                        message: err instanceof Error ? err.message : 'unknown error',
                    });
                }
            }
        }

        res.status(200).json({
            mode: execute ? 'execute' : 'dry-run',
            scanned: allObjects.length,
            claimed: claimedKeys.size,
            orphans,
            totalOrphanedBytes,
            deleted,
            errors,
        });
    } catch (err) {
        console.error('❌ Error in cleanupOrphanedVideos:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ── GET /api/admin/structure/files ────────────────────────────────────────
// Returns the project directory tree as nested JSON. Cached after first scan.

interface TreeNode {
    name: string;
    type: 'file' | 'directory';
    children?: TreeNode[];
}

const EXCLUDE = new Set([
    'node_modules', '.git', 'dist', 'build', '.vite-cache',
    'test-results', 'playwright-report', '.husky', 'coverage',
]);

function scanDir(dir: string, depth: number, maxDepth: number): TreeNode[] {
    if (depth >= maxDepth) return [];
    try {
        const entries = fsSync.readdirSync(dir, { withFileTypes: true });
        return entries
            .filter(e => !EXCLUDE.has(e.name) && !e.name.startsWith('.env'))
            .sort((a, b) => {
                if (a.isDirectory() && !b.isDirectory()) return -1;
                if (!a.isDirectory() && b.isDirectory()) return 1;
                return a.name.localeCompare(b.name);
            })
            .map(e => ({
                name: e.name,
                type: (e.isDirectory() ? 'directory' : 'file') as 'file' | 'directory',
                ...(e.isDirectory() ? { children: scanDir(path.join(dir, e.name), depth + 1, maxDepth) } : {}),
            }));
    } catch {
        return [];
    }
}

let cachedTree: { root: string; tree: TreeNode[] } | null = null;

export const getFileTree = async (_req: Request, res: Response) => {
    try {
        if (!cachedTree) {
            const projectRoot = path.resolve(__dirname, '..', '..');
            cachedTree = { root: path.basename(projectRoot), tree: scanDir(projectRoot, 0, 4) };
        }
        res.status(200).json(cachedTree);
    } catch (err) {
        console.error('❌ Error scanning file tree:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ── GET /api/admin/structure/routes ───────────────────────────────────────
// Returns all registered Express API routes.

export const getRoutes = async (_req: Request, res: Response) => {
    res.status(200).json({ routes: getRouteManifest() });
};

// ── GET /api/admin/architecture ──────────────────────────────────────────
// Serves the build-time architecture manifest for the Prod Design page.
export const getArchitectureManifest = async (_req: Request, res: Response): Promise<void> => {
    try {
        let manifest: unknown;
        try {
            const raw = await fs.readFile(ARCHITECTURE_MANIFEST_PATH, 'utf-8');
            manifest = JSON.parse(raw);
        } catch {
            manifest = {
                generatedAt: new Date(0).toISOString(),
                apiRoutes: [],
                migrations: [],
                models: [],
                frontendRoutes: [],
                topology: { mermaid: '', lastEdited: null, raw: '' },
                warnings: [
                    'architecture-manifest.json not found. Run `npm run build:architecture` ' +
                    'in backend_api to generate it.',
                ],
            };
        }
        res.setHeader('Cache-Control', 'private, no-cache');
        res.status(200).json(manifest);
    } catch (err) {
        console.error('❌ Error serving architecture manifest:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
