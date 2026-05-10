// Class attendance controller — backs TodayCard's pre/post-class Yes/No
// prompts. Three endpoints:
//
//   GET  /api/class-attendance?from=YYYY-MM-DD&to=YYYY-MM-DD
//   PUT  /api/class-attendance               (single-flag UPSERT)
//   POST /api/class-attendance/import        (one-time localStorage backfill)
//
// All endpoints require auth via verifyToken middleware.

import type { Request, Response } from 'express';
import {
    listAttendanceInWindow,
    upsertAttendanceFlag,
    batchImportAttendance,
    type AttendanceFlag,
    type AttendanceValue,
    type ImportEntry,
} from '../models/classAttendanceModel.js';

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const VALID_FLAGS = new Set<AttendanceFlag>(['planning', 'attended']);
const VALID_VALUES = new Set(['yes', 'no']);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

// Defensive cap so a runaway client can't blow up the import endpoint.
const MAX_IMPORT_ENTRIES = 500;

function todayMinusDays(days: number): string {
    const d = new Date(Date.now() - days * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function todayPlusDays(days: number): string {
    const d = new Date(Date.now() + days * 86_400_000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export const getAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }

        const fromQ = typeof req.query.from === 'string' ? req.query.from : '';
        const toQ   = typeof req.query.to   === 'string' ? req.query.to   : '';
        const from = DATE_RE.test(fromQ) ? fromQ : todayMinusDays(7);
        const to   = DATE_RE.test(toQ)   ? toQ   : todayPlusDays(7);
        if (from > to) { res.status(400).json({ message: '`from` must be ≤ `to`.' }); return; }

        const rows = await listAttendanceInWindow(userId, from, to);
        res.json({ attendance: rows });
    } catch (err) {
        console.error('Error fetching class attendance:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

interface PutBody {
    schedule_id?: unknown;
    date?: unknown;
    flag?: unknown;
    value?: unknown;
}

function sanitizePutBody(body: unknown): {
    scheduleId: string;
    date: string;
    flag: AttendanceFlag;
    value: AttendanceValue;
} | { error: string } {
    if (!body || typeof body !== 'object') return { error: 'Invalid body.' };
    const b = body as PutBody;

    const scheduleId = typeof b.schedule_id === 'string' ? b.schedule_id : '';
    if (!UUID_RE.test(scheduleId)) return { error: 'schedule_id must be a UUID.' };

    const date = typeof b.date === 'string' ? b.date : '';
    if (!DATE_RE.test(date)) return { error: 'date must be YYYY-MM-DD.' };

    const flag = typeof b.flag === 'string' ? b.flag : '';
    if (!VALID_FLAGS.has(flag as AttendanceFlag)) {
        return { error: 'flag must be "planning" or "attended".' };
    }

    // null is valid (clears the flag); 'yes' / 'no' are the other allowed values.
    let value: AttendanceValue;
    if (b.value === null) value = null;
    else if (typeof b.value === 'string' && VALID_VALUES.has(b.value)) {
        value = b.value as 'yes' | 'no';
    } else {
        return { error: 'value must be "yes", "no", or null.' };
    }

    return { scheduleId, date, flag: flag as AttendanceFlag, value };
}

export const putAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }

        const parsed = sanitizePutBody(req.body);
        if ('error' in parsed) { res.status(400).json({ message: parsed.error }); return; }

        const row = await upsertAttendanceFlag(
            userId,
            parsed.scheduleId,
            parsed.date,
            parsed.flag,
            parsed.value,
        );
        res.json({ attendance: row });
    } catch (err) {
        console.error('Error upserting class attendance:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};

interface ImportBody {
    entries?: unknown;
}

function sanitizeImportEntries(raw: unknown): ImportEntry[] | { error: string } {
    if (!Array.isArray(raw)) return { error: 'entries must be an array.' };
    if (raw.length > MAX_IMPORT_ENTRIES) {
        return { error: `entries length must be ≤ ${MAX_IMPORT_ENTRIES}.` };
    }

    const out: ImportEntry[] = [];
    for (let i = 0; i < raw.length; i++) {
        const e = raw[i];
        if (!e || typeof e !== 'object') return { error: `entries[${i}] is not an object.` };
        const o = e as Record<string, unknown>;

        const scheduleId = typeof o.schedule_id === 'string' ? o.schedule_id : '';
        if (!UUID_RE.test(scheduleId)) {
            return { error: `entries[${i}].schedule_id must be a UUID.` };
        }
        const date = typeof o.date === 'string' ? o.date : '';
        if (!DATE_RE.test(date)) {
            return { error: `entries[${i}].date must be YYYY-MM-DD.` };
        }

        const entry: ImportEntry = { schedule_id: scheduleId, date };

        // Only include each flag if the key is present. Missing keys preserve
        // the server's existing value via the model's COALESCE-on-absent logic.
        if ('planning' in o) {
            const v = o.planning;
            if (v === null) entry.planning = null;
            else if (typeof v === 'string' && VALID_VALUES.has(v)) entry.planning = v as 'yes' | 'no';
            else return { error: `entries[${i}].planning must be "yes", "no", or null.` };
        }
        if ('attended' in o) {
            const v = o.attended;
            if (v === null) entry.attended = null;
            else if (typeof v === 'string' && VALID_VALUES.has(v)) entry.attended = v as 'yes' | 'no';
            else return { error: `entries[${i}].attended must be "yes", "no", or null.` };
        }

        out.push(entry);
    }
    return out;
}

export const importAttendance = async (req: Request, res: Response): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) { res.status(401).json({ message: 'Unauthorized.' }); return; }

        const body = req.body as ImportBody;
        const parsed = sanitizeImportEntries(body?.entries);
        if (!Array.isArray(parsed)) { res.status(400).json({ message: parsed.error }); return; }

        const imported = await batchImportAttendance(userId, parsed);
        res.json({ imported });
    } catch (err) {
        console.error('Error importing class attendance:', err);
        res.status(500).json({ message: 'Server error.' });
    }
};
