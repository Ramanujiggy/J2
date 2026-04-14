import type { Request, Response } from 'express';
import { query } from '../config/db.js';
import { createSession, getSessionsByUser, updateSession as updateSessionModel, deleteSession as deleteSessionModel, bulkInsertSessions, type BulkSessionInput } from '../models/sessionModel.js';

const VALID_TAGS        = new Set(['standup', 'passing', 'pins', 'submissions', 'guard']);
const VALID_GI_NOGI     = new Set(['gi', 'no_gi']);
const VALID_SESSION_TYPES = new Set(['class', 'drilling', 'competition_training']);
const VALID_POLARITIES  = new Set(['offense', 'defense', 'neutral']);
const VALID_SOURCES     = new Set(['directed', 'organic']);
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

        const { date, duration, notes, gi_nogi, intensity, session_type, tags,
                heading, polarity, sub_skill_tag, script_source, resonance } = req.body;

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

        // heading is the new primary pillar selector; tags fall back to [heading] for backward compat
        if (heading !== undefined && heading !== null && !VALID_TAGS.has(heading)) {
            res.status(400).json({ message: 'Invalid heading.' });
            return;
        }
        if (polarity !== undefined && polarity !== null && !VALID_POLARITIES.has(polarity)) {
            res.status(400).json({ message: 'Invalid polarity.' });
            return;
        }
        if (script_source !== undefined && script_source !== null && !VALID_SOURCES.has(script_source)) {
            res.status(400).json({ message: 'Invalid script_source.' });
            return;
        }
        if (sub_skill_tag !== undefined && sub_skill_tag !== null) {
            if (typeof sub_skill_tag !== 'string' || sub_skill_tag.length > 50) {
                res.status(400).json({ message: 'sub_skill_tag must be a string ≤ 50 chars.' });
                return;
            }
        }
        const resonanceNum = (resonance !== undefined && resonance !== null) ? Number(resonance) : null;
        if (resonanceNum !== null && (!Number.isInteger(resonanceNum) || resonanceNum < 1 || resonanceNum > 10)) {
            res.status(400).json({ message: 'resonance must be an integer 1–10.' });
            return;
        }

        // Derive tags: explicit array wins; fall back to [heading]; then reject
        const finalTags = isValidTagArray(tags) ? tags : (heading ? [heading] : null);
        if (!finalTags) {
            res.status(400).json({ message: 'At least one valid skill tag is required.' });
            return;
        }

        const session = await createSession(
            userId, date, durationNum, notes ?? '', gi_nogi, intensityNum, session_type, finalTags,
            heading ?? null, polarity ?? null, sub_skill_tag ?? null, script_source ?? null, resonanceNum,
        );
        res.status(201).json({ message: 'Session logged.', session, session_count: session.session_count });
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

        const { from, to } = req.query as { from?: string; to?: string };
        if (from && !DATE_RE.test(from)) {
            res.status(400).json({ message: 'from must be a valid YYYY-MM-DD date.' });
            return;
        }
        if (to && !DATE_RE.test(to)) {
            res.status(400).json({ message: 'to must be a valid YYYY-MM-DD date.' });
            return;
        }

        const sessions = await getSessionsByUser(userId, from, to);
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
        if (!id) { res.status(400).json({ message: 'Session id is required.' }); return; }
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

        const { sessions, confirmDuplicates } = req.body;

        if (!Array.isArray(sessions) || sessions.length === 0) {
            res.status(400).json({ message: 'sessions must be a non-empty array.' });
            return;
        }

        if (sessions.length > 2000) {
            res.status(400).json({ message: 'Maximum 2000 sessions per import.' });
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

            // Optional migration-005 fields — validate only if present
            if (s.heading !== undefined && s.heading !== null && !VALID_TAGS.has(s.heading)) {
                res.status(400).json({ message: `${rowLabel}: invalid heading.` });
                return;
            }
            if (s.polarity !== undefined && s.polarity !== null && !VALID_POLARITIES.has(s.polarity)) {
                res.status(400).json({ message: `${rowLabel}: invalid polarity.` });
                return;
            }
            if (s.script_source !== undefined && s.script_source !== null && !VALID_SOURCES.has(s.script_source)) {
                res.status(400).json({ message: `${rowLabel}: invalid script_source.` });
                return;
            }
            if (s.sub_skill_tag !== undefined && s.sub_skill_tag !== null) {
                if (typeof s.sub_skill_tag !== 'string' || s.sub_skill_tag.length > 50) {
                    res.status(400).json({ message: `${rowLabel}: sub_skill_tag must be a string ≤ 50 chars.` });
                    return;
                }
            }
            const resNum = (s.resonance !== undefined && s.resonance !== null) ? Number(s.resonance) : null;
            if (resNum !== null && (!Number.isInteger(resNum) || resNum < 1 || resNum > 10)) {
                res.status(400).json({ message: `${rowLabel}: resonance must be an integer 1–10.` });
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
                heading: s.heading ?? null,
                polarity: s.polarity ?? null,
                sub_skill_tag: s.sub_skill_tag ?? null,
                script_source: s.script_source ?? null,
                resonance: resNum,
            });
        }

        // Check for duplicate dates unless explicitly confirmed
        if (!confirmDuplicates) {
            const importDates = [...new Set(validated.map(s => s.date))];
            const existing = await query(
                `SELECT DISTINCT date::text FROM training_sessions WHERE user_id = $1 AND date = ANY($2::date[])`,
                [userId, importDates],
            );
            if (existing.rows.length > 0) {
                const duplicateDates = existing.rows.map((r: { date: string }) => r.date.slice(0, 10));
                res.status(409).json({
                    message: `${duplicateDates.length} date${duplicateDates.length > 1 ? 's' : ''} already exist in your log.`,
                    duplicateDates,
                });
                return;
            }
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
        const { duration, gi_nogi, intensity, session_type, notes, tags,
                heading, polarity, sub_skill_tag, script_source, resonance } = req.body;

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

        if (heading !== undefined && heading !== null && !VALID_TAGS.has(heading)) {
            res.status(400).json({ message: 'Invalid heading.' });
            return;
        }
        if (polarity !== undefined && polarity !== null && !VALID_POLARITIES.has(polarity)) {
            res.status(400).json({ message: 'Invalid polarity.' });
            return;
        }
        if (script_source !== undefined && script_source !== null && !VALID_SOURCES.has(script_source)) {
            res.status(400).json({ message: 'Invalid script_source.' });
            return;
        }
        if (sub_skill_tag !== undefined && sub_skill_tag !== null) {
            if (typeof sub_skill_tag !== 'string' || sub_skill_tag.length > 50) {
                res.status(400).json({ message: 'sub_skill_tag must be a string ≤ 50 chars.' });
                return;
            }
        }
        const resonanceNum = (resonance !== undefined && resonance !== null) ? Number(resonance) : null;
        if (resonanceNum !== null && (!Number.isInteger(resonanceNum) || resonanceNum < 1 || resonanceNum > 10)) {
            res.status(400).json({ message: 'resonance must be an integer 1–10.' });
            return;
        }

        const finalTags = isValidTagArray(tags) ? tags : (heading ? [heading] : []);

        const session = await updateSessionModel(
            id as string, userId,
            durationNum, gi_nogi, intensityNum, session_type, notes ?? '',
            finalTags,
            heading ?? null, polarity ?? null, sub_skill_tag ?? null, script_source ?? null, resonanceNum,
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
