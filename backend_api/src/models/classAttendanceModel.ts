// Class attendance — backs TodayCard's pre/post-class Yes/No prompts.
// One row per (user, schedule, date); two nullable flags per row.
//
// All UPSERTs key on the UNIQUE (user_id, schedule_id, date) constraint
// from migration 029, so:
//   • repeated PUTs to the same flag are idempotent (last write wins)
//   • the one-time localStorage import is safe to re-run across devices
//   • setting one flag never disturbs the other (per-column COALESCE)

import { query } from '../config/db.js';

export type AttendanceFlag = 'planning' | 'attended';
export type AttendanceValue = 'yes' | 'no' | null;

export interface ClassAttendance {
    id: string;
    user_id: string;
    schedule_id: string;
    date: string;            // YYYY-MM-DD
    planning: 'yes' | 'no' | null;
    attended: 'yes' | 'no' | null;
    updated_at: string;
}

// Window query — TodayCard's mount fetch wants attendance for the next
// week or so, including any back-dated answers in the recent past.
export async function listAttendanceInWindow(
    userId: string,
    fromDate: string,
    toDate: string,
): Promise<ClassAttendance[]> {
    const result = await query(
        `SELECT id, user_id, schedule_id,
                to_char(date, 'YYYY-MM-DD') AS date,
                planning, attended,
                updated_at
           FROM class_attendance
          WHERE user_id = $1
            AND date BETWEEN $2 AND $3
          ORDER BY date DESC`,
        [userId, fromDate, toDate],
    );
    return result.rows as ClassAttendance[];
}

// Single-flag UPSERT. The other flag is preserved via COALESCE(EXCLUDED, ...)
// — passing NULL to clear a flag is intentional and not the same as "leave
// the existing value alone." The controller is responsible for translating
// the API's flag-and-value payload into the right argument here.
export async function upsertAttendanceFlag(
    userId: string,
    scheduleId: string,
    date: string,
    flag: AttendanceFlag,
    value: AttendanceValue,
): Promise<ClassAttendance> {
    // Identifier-safe column name: AttendanceFlag is a literal union, so
    // string interpolation here is sound.
    const setColumn = flag;
    const result = await query(
        `INSERT INTO class_attendance (user_id, schedule_id, date, ${setColumn})
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, schedule_id, date)
         DO UPDATE SET ${setColumn} = EXCLUDED.${setColumn},
                       updated_at = NOW()
         RETURNING id, user_id, schedule_id,
                   to_char(date, 'YYYY-MM-DD') AS date,
                   planning, attended, updated_at`,
        [userId, scheduleId, date, value],
    );
    return result.rows[0] as ClassAttendance;
}

export interface ImportEntry {
    schedule_id: string;
    date: string;
    planning?: AttendanceValue;
    attended?: AttendanceValue;
}

// Batch UPSERT for the one-time localStorage backfill. Each entry can carry
// either or both flags; absent fields fall through to COALESCE so they don't
// overwrite a server-side value the user has since set on another device.
//
// "Absent" is distinct from "explicitly null" here: we only treat a flag as
// nullable-clear when the entry includes the key with value `null`. Missing
// keys preserve the existing server value (LOCALSTORAGE wins → SERVER falls
// through). Most localStorage entries will only carry one of the two flags.
export async function batchImportAttendance(
    userId: string,
    entries: ImportEntry[],
): Promise<number> {
    if (entries.length === 0) return 0;

    let inserted = 0;
    for (const e of entries) {
        // Build the SET clause based on which flags this entry carries.
        // For an entry carrying only `planning`, SET planning = EXCLUDED.planning
        // and don't touch `attended` — preserves whatever's on the server.
        const sets: string[] = [];
        const insertCols = ['user_id', 'schedule_id', 'date'];
        const insertParams: unknown[] = [userId, e.schedule_id, e.date];

        if ('planning' in e) {
            insertCols.push('planning');
            insertParams.push(e.planning ?? null);
            sets.push('planning = EXCLUDED.planning');
        }
        if ('attended' in e) {
            insertCols.push('attended');
            insertParams.push(e.attended ?? null);
            sets.push('attended = EXCLUDED.attended');
        }

        // Defensive — if neither flag was supplied, skip rather than insert
        // an all-NULL row.
        if (sets.length === 0) continue;
        sets.push('updated_at = NOW()');

        const placeholders = insertParams.map((_, i) => `$${i + 1}`).join(', ');
        const sql = `
            INSERT INTO class_attendance (${insertCols.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT (user_id, schedule_id, date)
            DO UPDATE SET ${sets.join(', ')}
        `;
        await query(sql, insertParams);
        inserted++;
    }
    return inserted;
}
