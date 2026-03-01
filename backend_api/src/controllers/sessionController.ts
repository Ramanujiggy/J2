import type { Request, Response } from 'express';
import { createSession, getSessionsByUser } from '../models/sessionModel.js';

export const logSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { date, duration, notes, gi_nogi, intensity, session_type } = req.body;

        if (!date || !duration || !gi_nogi || !intensity || !session_type) {
            res.status(400).json({ message: 'Date, duration, gi/no-gi, intensity, and session type are required.' });
            return;
        }

        const session = await createSession(userId, date, Number(duration), notes ?? '', gi_nogi, Number(intensity), session_type);
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
