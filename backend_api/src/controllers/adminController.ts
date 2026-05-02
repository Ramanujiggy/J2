// adminController — admin-only dashboard endpoints. All routes mounted at
// /api/admin/* are gated by verifyToken + requireAdmin (see adminRoutes).

import type { Request, Response } from 'express';
import { z } from 'zod';
import { query } from '../config/db.js';
import { listCases, updateCase } from '../models/supportCaseModel.js';

// ── GET /api/admin/stats ──────────────────────────────────────────────────
// Single-row aggregate. Cheap enough to run on every dashboard load.
export const getStats = async (_req: Request, res: Response): Promise<void> => {
    try {
        const result = await query(`
            SELECT
              (SELECT COUNT(*) FROM users)                                                              AS total_users,
              (SELECT COUNT(*) FROM users             WHERE created_at > NOW() - INTERVAL '24 hours')   AS users_24h,
              (SELECT COUNT(*) FROM users             WHERE created_at > NOW() - INTERVAL '7 days')     AS users_7d,
              (SELECT COUNT(*) FROM training_sessions)                                                  AS total_sessions,
              (SELECT COUNT(*) FROM training_sessions WHERE created_at > NOW() - INTERVAL '24 hours')   AS sessions_24h,
              (SELECT COUNT(*) FROM training_sessions WHERE created_at > NOW() - INTERVAL '7 days')     AS sessions_7d,
              (SELECT COUNT(*) FROM support_cases     WHERE status = 'open')                            AS cases_open,
              (SELECT COUNT(*) FROM support_cases     WHERE status = 'in_progress')                     AS cases_in_progress
        `);
        const r = result.rows[0] as {
            total_users: string;
            users_24h: string;
            users_7d: string;
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
                session_count:   Number(u.session_count),
                last_session_at: u.last_session_at,
            })),
        });
    } catch (err) {
        console.error('❌ Error listing users:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
