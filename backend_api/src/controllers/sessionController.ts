import type { Request, Response } from 'express';
import { query } from '../config/db.js';
import { createSession, getSessionsByUser, searchSessions, updateSession as updateSessionModel, deleteSession as deleteSessionModel, bulkInsertSessions, type SessionFilter, type BulkSessionInput, type PillarDistribution } from '../models/sessionModel.js';
import { getUserTagsByIds } from '../models/userTagModel.js';
import { filterExistingCanonicalIds } from '../models/canonicalPositionModel.js';

const VALID_TAGS        = new Set(['standup', 'passing', 'pins', 'submissions', 'guard']);
const VALID_GI_NOGI     = new Set(['gi', 'no_gi']);
const VALID_SESSION_TYPES = new Set(['class', 'drilling', 'competition_training']);
const VALID_POLARITIES  = new Set(['offense', 'defense', 'neutral']);
const VALID_SOURCES     = new Set(['directed', 'organic']);
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidTagArray(v: unknown): v is string[] {
    return Array.isArray(v) && v.length > 0 && v.every(t => VALID_TAGS.has(t as string));
}

/**
 * Sanitize a user_tag_ids input from the client:
 * - filter to non-empty strings matching UUID format
 * - deduplicate
 * - verify each ID belongs to the authenticated user (drops orphans/foreign IDs)
 *
 * Returns null if input wasn't an array; returns [] if input was empty/all-invalid.
 */
async function sanitizeUserTagIds(userId: string, raw: unknown): Promise<string[] | null> {
    if (!Array.isArray(raw)) return null;
    const wellFormed = raw.filter((s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s));
    const deduped = [...new Set(wellFormed)];
    if (deduped.length === 0) return [];
    const owned = await getUserTagsByIds(userId, deduped);
    const ownedSet = new Set(owned.map(t => t.id));
    return deduped.filter(id => ownedSet.has(id));
}

/**
 * Sanitize a canonical_position_ids input from the client:
 * - filter to UUID-shaped strings, dedupe
 * - verify each ID exists in canonical_positions (unknown IDs dropped silently,
 *   matching sanitizeUserTagIds — never 400 on orphaned refs)
 *
 * Returns null if input wasn't an array; returns [] if empty/all-invalid.
 */
async function sanitizeCanonicalPositionIds(raw: unknown): Promise<string[] | null> {
    if (!Array.isArray(raw)) return null;
    const wellFormed = raw.filter((s: unknown): s is string => typeof s === 'string' && UUID_RE.test(s));
    const deduped = [...new Set(wellFormed)];
    if (deduped.length === 0) return [];
    return filterExistingCanonicalIds(deduped);
}

/**
 * Sanitize a pillar_distribution input from the client:
 * - must be a plain object
 * - keys must be valid pillars (unknown keys dropped)
 * - values must be finite numbers in [0, 1] (others dropped)
 * - if any kept entries, weights are renormalized so they sum to exactly 1.0
 *   (handles client-side floating-point drift cleanly)
 *
 * Returns null if input is missing/invalid/empty after filtering.
 */
function sanitizePillarDistribution(raw: unknown): PillarDistribution | null {
    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
    const cleaned: Record<string, number> = {};
    let sum = 0;
    for (const [key, val] of Object.entries(raw as Record<string, unknown>)) {
        if (!VALID_TAGS.has(key)) continue;
        const n = Number(val);
        if (!Number.isFinite(n) || n < 0 || n > 1) continue;
        if (n === 0) continue; // skip zero-weight pillars to keep the JSON minimal
        cleaned[key] = n;
        sum += n;
    }
    if (sum <= 0) return null;
    // Renormalize so weights sum to exactly 1.0 — fixes float drift from client
    for (const k of Object.keys(cleaned)) {
        cleaned[k] = Math.round((cleaned[k]! / sum) * 10000) / 10000;
    }
    return cleaned as PillarDistribution;
}

/**
 * Sanitize a single boolean telemetry field. Returns null if missing/invalid;
 * the raw value if it's a real boolean. Strings like "true"/"false" are NOT
 * accepted — clients must send actual booleans.
 */
function sanitizeBool(raw: unknown): boolean | null {
    return typeof raw === 'boolean' ? raw : null;
}

/**
 * Sanitize a non-negative integer telemetry field. Returns null if missing
 * or invalid. Clamps to a reasonable upper bound to defend against bogus input.
 */
function sanitizeNonNegInt(raw: unknown): number | null {
    if (raw === undefined || raw === null) return null;
    const n = Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > 100) return null;
    return n;
}

/**
 * Sanitize the deep_work_pillars input from the client:
 * - must be an array of valid pillar strings (unknown values dropped)
 * - dedupe
 * Returns null if missing or invalid; [] if input was empty/all-invalid.
 * Stored verbatim so sessionToSelections() can re-flag the right chips on reopen.
 */
function sanitizeDeepWorkPillars(raw: unknown): string[] | null {
    if (!Array.isArray(raw)) return null;
    const valid = raw.filter((v): v is string => typeof v === 'string' && VALID_TAGS.has(v));
    return [...new Set(valid)];
}

export const logSession = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { date, duration, notes, gi_nogi, intensity, session_type, tags,
                heading, polarity, sub_skill_tag, script_source, resonance, user_tag_ids, pillar_distribution,
                canonical_position_ids, had_primary, had_deep_work, selection_count, deep_work_pillars } = req.body;

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

        // Sanitize user_tag_ids: validate UUID format, deduplicate, verify ownership
        const userTagIds = await sanitizeUserTagIds(userId, user_tag_ids);

        // Sanitize canonical_position_ids: UUID + dedupe + filter to existing rows
        const canonicalIds = await sanitizeCanonicalPositionIds(canonical_position_ids);

        // Sanitize pillar_distribution; fall back to { heading: 1.0 } if not supplied
        let dist = sanitizePillarDistribution(pillar_distribution);
        if (!dist && heading) dist = { [heading as 'guard']: 1.0 } as PillarDistribution;

        const session = await createSession(
            userId, date, durationNum, notes ?? '', gi_nogi, intensityNum, session_type, finalTags,
            heading ?? null, polarity ?? null, sub_skill_tag ?? null, script_source ?? null, resonanceNum,
            userTagIds, dist, canonicalIds,
            sanitizeBool(had_primary), sanitizeBool(had_deep_work), sanitizeNonNegInt(selection_count),
            sanitizeDeepWorkPillars(deep_work_pillars),
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

export const searchSessionsHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }

        const { from, to, q, gi_nogi, session_type, heading, polarity,
                intensity_min, intensity_max, user_tag_id, limit, offset } = req.query as Record<string, string | undefined>;

        if (from && !DATE_RE.test(from)) { res.status(400).json({ message: 'from must be YYYY-MM-DD.' }); return; }
        if (to && !DATE_RE.test(to)) { res.status(400).json({ message: 'to must be YYYY-MM-DD.' }); return; }
        if (gi_nogi && !VALID_GI_NOGI.has(gi_nogi)) { res.status(400).json({ message: 'Invalid gi_nogi.' }); return; }
        if (session_type && !VALID_SESSION_TYPES.has(session_type)) { res.status(400).json({ message: 'Invalid session_type.' }); return; }
        if (heading && !VALID_TAGS.has(heading)) { res.status(400).json({ message: 'Invalid heading.' }); return; }
        if (polarity && !VALID_POLARITIES.has(polarity)) { res.status(400).json({ message: 'Invalid polarity.' }); return; }

        const filters: SessionFilter = {
            limit: limit ? Number(limit) : 50,
            offset: offset ? Number(offset) : 0,
        };
        if (from) filters.from = from;
        if (to) filters.to = to;
        if (q) filters.q = q;
        if (gi_nogi) filters.gi_nogi = gi_nogi as 'gi' | 'no_gi';
        if (session_type) filters.session_type = session_type;
        if (heading) filters.heading = heading;
        if (polarity) filters.polarity = polarity;
        if (intensity_min) filters.intensity_min = Number(intensity_min);
        if (intensity_max) filters.intensity_max = Number(intensity_max);
        if (user_tag_id) filters.user_tag_id = user_tag_id;

        const result = await searchSessions(userId, filters);
        res.json({ sessions: result.sessions, total: result.total });
    } catch (err) {
        console.error('Error searching sessions:', err);
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

            // Tags are required and must be non-empty
            if (!Array.isArray(s.tags) || s.tags.length === 0) {
                res.status(400).json({ message: `${rowLabel}: tags must be a non-empty array.` });
                return;
            }
            if (!isValidTagArray(s.tags)) {
                res.status(400).json({ message: `${rowLabel}: invalid skill tag value.` });
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
                tags: Array.isArray(s.tags) ? s.tags : [],
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
                heading, polarity, sub_skill_tag, script_source, resonance, user_tag_ids, pillar_distribution,
                canonical_position_ids, had_primary, had_deep_work, selection_count, deep_work_pillars } = req.body;

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

        const userTagIds = await sanitizeUserTagIds(userId, user_tag_ids);
        const canonicalIds = await sanitizeCanonicalPositionIds(canonical_position_ids);

        let dist = sanitizePillarDistribution(pillar_distribution);
        if (!dist && heading) dist = { [heading as 'guard']: 1.0 } as PillarDistribution;

        const session = await updateSessionModel(
            id as string, userId,
            durationNum, gi_nogi, intensityNum, session_type, notes ?? '',
            finalTags,
            heading ?? null, polarity ?? null, sub_skill_tag ?? null, script_source ?? null, resonanceNum,
            userTagIds, dist, canonicalIds,
            sanitizeBool(had_primary), sanitizeBool(had_deep_work), sanitizeNonNegInt(selection_count),
            sanitizeDeepWorkPillars(deep_work_pillars),
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
