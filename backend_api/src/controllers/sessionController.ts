import type { Request, Response } from 'express';
import { createSession, getSessionsByUser, updateSession as updateSessionModel, deleteSession as deleteSessionModel, bulkInsertSessions, type BulkSessionInput } from '../models/sessionModel.js';

const VALID_TAGS = new Set(['standup', 'guard_retention', 'submissions', 'pin_escapes', 'guard_passing']);
const VALID_GI_NOGI = new Set(['gi', 'no_gi']);
const VALID_SESSION_TYPES = new Set(['class', 'drilling', 'competition_training']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isValidTagArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.length > 0 && v.every(t => VALID_TAGS.has(t as string));
}

export const logSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { date, duration, notes, gi_nogi, intensity, session_type, tags } = req.body;

        if (!date || duration === undefined || !gi_nogi || intensity === undefined || !session_type) {
            res.status(400).json({ message: 'Date, duration, gi/no-gi, intensity, and session type are required.' });
            return;
        }

        if (!DATE_RE.test(date) || isNaN(Date.parse(date))) {
            res.status(400).json({ message: 'date must be a valid YYYY-MM-DD string.' });
            return;
        }

        const durationNum = Number(duration);
        if (!Number.isInteger(durationNum) || durationNum < 1 || durationNum > 720) {
            res.status(400).json({ message: 'duration must be a whole number of minutes between 1 and 720.' });
            return;
        }

        const intensityNum = Number(intensity);
        if (!Number.isInteger(intensityNum) || intensityNum < 1 || intensityNum > 5) {
            res.status(400).json({ message: 'intensity must be an integer between 1 and 5.' });
            return;
        }

        if (!VALID_GI_NOGI.has(gi_nogi)) {
            res.status(400).json({ message: 'gi_nogi must be "gi" or "no_gi".' });
            return;
        }

        if (!VALID_SESSION_TYPES.has(session_type)) {
            res.status(400).json({ message: 'session_type must be "class", "drilling", or "competition_training".' });
            return;
        }

        if (!isValidTagArray(tags)) {
            res.status(400).json({ message: 'At least one valid skill tag is required.' });
            return;
        }

        const session = await createSession(userId, date, durationNum, notes ?? '', gi_nogi, intensityNum, session_type, tags);
        res.status(201).json({ message: 'Session logged.', session });
    } catch (err) {
        console.error('❌ Error logging session:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const getSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const sessions = await getSessionsByUser(userId);
        res.json({ sessions });
    } catch (err) {
        console.error('❌ Error fetching sessions:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const deleteSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { id } = req.params;
        const deleted = await deleteSessionModel(id, userId);

        if (!deleted) {
            res.status(404).json({ message: 'Session not found.' });
            return;
        }

        res.json({ message: 'Session deleted.' });
    } catch (err) {
        console.error('❌ Error deleting session:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

export const importSessions = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { sessions } = req.body;

        if (!Array.isArray(sessions) || sessions.length === 0) {
            res.status(400).json({ message: 'sessions must be a non-empty array.' });
            return;
        }

        if (sessions.length > 500) {
            res.status(400).json({ message: 'Maximum 500 sessions per import.' });
            return;
        }

        // Validate every row before touching the DB
        const validated: BulkSessionInput[] = [];
        for (let i = 0; i < sessions.length; i++) {
            const s = sessions[i];
            const rowLabel = `Row ${i + 1}`;

            if (!s.date || !DATE_RE.test(s.date) || isNaN(Date.parse(s.date))) {
                res.status(400).json({ message: `${rowLabel}: invalid date "${s.date}".` });
                return;
            }

            const dur = Number(s.duration);
            if (!Number.isInteger(dur) || dur < 1 || dur > 720) {
                res.status(400).json({ message: `${rowLabel}: duration must be 1–720 minutes.` });
                return;
            }

            const inten = Number(s.intensity);
            if (!Number.isInteger(inten) || inten < 1 || inten > 5) {
                res.status(400).json({ message: `${rowLabel}: intensity must be 1–5.` });
                return;
            }

            if (!VALID_GI_NOGI.has(s.gi_nogi)) {
                res.status(400).json({ message: `${rowLabel}: gi_nogi must be "gi" or "no_gi".` });
                return;
            }

            if (!VALID_SESSION_TYPES.has(s.session_type)) {
                res.status(400).json({ message: `${rowLabel}: invalid session_type.` });
                return;
            }

            if (!isValidTagArray(s.tags)) {
                res.status(400).json({ message: `${rowLabel}: at least one valid skill tag required.` });
                return;
            }

            validated.push({
                date: s.date,
                duration: dur,
                gi_nogi: s.gi_nogi,
                intensity: inten,
                session_type: s.session_type,
                tags: s.tags,
                notes: typeof s.notes === 'string' ? s.notes : '',
            });
        }

        const imported = await bulkInsertSessions(userId, validated);
        res.status(201).json({ imported });
    } catch (err) {
        console.error('❌ Error importing sessions:', err);
        res.status(500).json({ message: 'Server error during import.' });
    }
};

export const updateSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { id } = req.params;
        const { duration, gi_nogi, intensity, session_type, notes, tags } = req.body;

        if (duration === undefined || !gi_nogi || intensity === undefined || !session_type) {
            res.status(400).json({ message: 'Duration, gi/no-gi, intensity, and session type are required.' });
            return;
        }

        const durationNum = Number(duration);
        if (!Number.isInteger(durationNum) || durationNum < 1 || durationNum > 720) {
            res.status(400).json({ message: 'duration must be a whole number of minutes between 1 and 720.' });
            return;
        }

        const intensityNum = Number(intensity);
        if (!Number.isInteger(intensityNum) || intensityNum < 1 || intensityNum > 5) {
            res.status(400).json({ message: 'intensity must be an integer between 1 and 5.' });
            return;
        }

        if (!VALID_GI_NOGI.has(gi_nogi)) {
            res.status(400).json({ message: 'gi_nogi must be "gi" or "no_gi".' });
            return;
        }

        if (!VALID_SESSION_TYPES.has(session_type)) {
            res.status(400).json({ message: 'session_type must be "class", "drilling", or "competition_training".' });
            return;
        }

        const resolvedTags = isValidTagArray(tags) ? tags : [];

        const session = await updateSessionModel(
            id as string, userId,
            durationNum, gi_nogi, intensityNum, session_type, notes ?? '',
            resolvedTags
        );

        if (!session) {
            res.status(404).json({ message: 'Session not found.' });
            return;
        }

        res.json({ message: 'Session updated.', session });
    } catch (err) {
        console.error('❌ Error updating session:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
