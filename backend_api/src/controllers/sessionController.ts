import type { Request, Response } from 'express';
import { createSession, getSessionsByUser, updateSession as updateSessionModel, deleteSession as deleteSessionModel } from '../models/sessionModel.js';

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
