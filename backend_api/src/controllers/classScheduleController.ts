import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import {
    listSchedulesForUser,
    createSchedule,
    updateSchedule,
    softDeleteSchedule,
    type ClassScheduleInput,
} from '../models/classScheduleModel.js';

const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/;
const VALID_GI_NOGI = new Set(['gi', 'no_gi', 'both']);

function sanitize(body: unknown): { input: ClassScheduleInput | null; error: string | null } {
    if (!body || typeof body !== 'object') return { input: null, error: 'Invalid body.' };
    const b = body as Record<string, unknown>;

    const name = typeof b.name === 'string' ? b.name.trim() : '';
    if (!name || name.length > 120) return { input: null, error: 'name must be 1–120 chars.' };

    const day = Number(b.day_of_week);
    if (!Number.isInteger(day) || day < 0 || day > 6) {
        return { input: null, error: 'day_of_week must be 0–6.' };
    }

    const start = typeof b.start_time === 'string' ? b.start_time : '';
    if (!TIME_RE.test(start)) return { input: null, error: 'start_time must be HH:MM[:SS].' };

    const dur = Number(b.duration_min);
    if (!Number.isInteger(dur) || dur < 15 || dur > 480) {
        return { input: null, error: 'duration_min must be 15–480.' };
    }

    let giNogi: 'gi' | 'no_gi' | 'both' | null = null;
    if (b.gi_nogi != null && b.gi_nogi !== '') {
        if (typeof b.gi_nogi !== 'string' || !VALID_GI_NOGI.has(b.gi_nogi)) {
            return { input: null, error: 'gi_nogi must be "gi", "no_gi", or "both".' };
        }
        giNogi = b.gi_nogi as 'gi' | 'no_gi' | 'both';
    }

    return { input: { name, day_of_week: day, start_time: start, duration_min: dur, gi_nogi: giNogi }, error: null };
}

export const listClassSchedules = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }
        const schedules = await listSchedulesForUser(userId);

        // Weak ETag over (id, name, day_of_week, start_time, duration_min, gi_nogi).
        // Schedules are nearly write-once after onboarding — most users tweak
        // them rarely. Hashing the displayed fields invalidates on every
        // user-visible change. Cheap to compute (typically < 10 schedules).
        const etag = 'W/"' + createHash('sha1')
            .update(schedules.map(s => `${s.id}:${s.name}:${s.day_of_week}:${s.start_time}:${s.duration_min}:${s.gi_nogi ?? ''}`).join('|'))
            .digest('base64')
            .slice(0, 20) + '"';

        if (req.headers['if-none-match'] === etag) {
            res.status(304).end();
            return;
        }

        res.setHeader('ETag', etag);
        // `no-cache` forces revalidation on every request — the ETag still
        // gives us a cheap 304 when nothing changed, but the browser can
        // never serve a stale cached body after a PATCH / POST / DELETE
        // (which is what `max-age=300` here used to enable, masking writes
        // for up to 5 minutes after they succeeded).
        res.setHeader('Cache-Control', 'private, no-cache');
        res.json({ schedules });
    } catch (err) {
        console.error('Error listing class schedules:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const createClassSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }
        const { input, error } = sanitize(req.body);
        if (!input) { res.status(400).json({ message: error ?? 'Invalid input.' }); return; }
        const schedule = await createSchedule(userId, input);
        res.status(201).json({ schedule });
    } catch (err) {
        console.error('Error creating class schedule:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const updateClassSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }
        const { id } = req.params;
        if (!id) { res.status(400).json({ message: 'Schedule id is required.' }); return; }
        const { input, error } = sanitize(req.body);
        if (!input) { res.status(400).json({ message: error ?? 'Invalid input.' }); return; }
        const schedule = await updateSchedule(id, userId, input);
        if (!schedule) { res.status(404).json({ message: 'Schedule not found.' }); return; }
        res.json({ schedule });
    } catch (err) {
        console.error('Error updating class schedule:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const deleteClassSchedule = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }
        const { id } = req.params;
        if (!id) { res.status(400).json({ message: 'Schedule id is required.' }); return; }
        const deleted = await softDeleteSchedule(id, userId);
        if (!deleted) { res.status(404).json({ message: 'Schedule not found.' }); return; }
        res.status(204).send();
    } catch (err) {
        console.error('Error deleting class schedule:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
