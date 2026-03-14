import type { Request, Response } from 'express';
import { createSession, getSessionsByUser, updateSession as updateSessionModel } from '../models/sessionModel.js';

const VALID_TAGS = new Set(['standup', 'guard_retention', 'submissions', 'pin_escapes', 'guard_passing']);

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

        if (!date || !duration || !gi_nogi || !intensity || !session_type) {
            res.status(400).json({ message: 'Date, duration, gi/no-gi, intensity, and session type are required.' });
            return;
        }

        if (!isValidTagArray(tags)) {
            res.status(400).json({ message: 'At least one valid skill tag is required.' });
            return;
        }

        const session = await createSession(userId, date, Number(duration), notes ?? '', gi_nogi, Number(intensity), session_type, tags);
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

export const updateSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { id } = req.params;
        const { duration, gi_nogi, intensity, session_type, notes, tags } = req.body;

        if (!duration || !gi_nogi || !intensity || !session_type) {
            res.status(400).json({ message: 'Duration, gi/no-gi, intensity, and session type are required.' });
            return;
        }

        const resolvedTags = isValidTagArray(tags) ? tags : [];

        const session = await updateSessionModel(
            id as string, userId,
            Number(duration), gi_nogi, Number(intensity), session_type, notes ?? '',
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
