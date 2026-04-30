// Class schedules — recurring weekly class slots per user.
// Times are stored in the user's local clock (TIME column, no tz). The
// scheduler joins with users.timezone (mig 019) at notification time to
// decide whether "now in user-local" matches a slot.

import { query } from '../config/db.js';

export interface ClassSchedule {
    id: string;
    user_id: string;
    name: string;
    day_of_week: number;            // 0=Sun … 6=Sat
    start_time: string;             // 'HH:MM:SS' (Postgres TIME)
    duration_min: number;
    gi_nogi: 'gi' | 'no_gi' | null;
    is_active: boolean;
    created_at: string;
}

export interface ClassScheduleInput {
    name: string;
    day_of_week: number;
    start_time: string;             // 'HH:MM' or 'HH:MM:SS'
    duration_min: number;
    gi_nogi: 'gi' | 'no_gi' | null;
}

export const listSchedulesForUser = async (userId: string): Promise<ClassSchedule[]> => {
    const result = await query(
        `SELECT * FROM class_schedules
         WHERE user_id = $1 AND is_active = true
         ORDER BY day_of_week ASC, start_time ASC`,
        [userId],
    );
    return result.rows as ClassSchedule[];
};

export const createSchedule = async (userId: string, input: ClassScheduleInput): Promise<ClassSchedule> => {
    const result = await query(
        `INSERT INTO class_schedules (user_id, name, day_of_week, start_time, duration_min, gi_nogi)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [userId, input.name, input.day_of_week, input.start_time, input.duration_min, input.gi_nogi],
    );
    return result.rows[0] as ClassSchedule;
};

export const updateSchedule = async (
    id: string,
    userId: string,
    input: ClassScheduleInput,
): Promise<ClassSchedule | null> => {
    const result = await query(
        `UPDATE class_schedules
         SET name = $1, day_of_week = $2, start_time = $3, duration_min = $4, gi_nogi = $5
         WHERE id = $6 AND user_id = $7 AND is_active = true
         RETURNING *`,
        [input.name, input.day_of_week, input.start_time, input.duration_min, input.gi_nogi, id, userId],
    );
    return (result.rows[0] as ClassSchedule | undefined) ?? null;
};

export const softDeleteSchedule = async (id: string, userId: string): Promise<boolean> => {
    const result = await query(
        `UPDATE class_schedules SET is_active = false
         WHERE id = $1 AND user_id = $2 AND is_active = true`,
        [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
};

// Used by the notification scheduler. Joins with users.timezone so the
// scheduler can do the UTC→local conversion in a single pass.
export interface ScheduleWithTimezone extends ClassSchedule {
    timezone: string;
}

export const listAllActiveSchedulesWithTimezone = async (): Promise<ScheduleWithTimezone[]> => {
    const result = await query(
        `SELECT cs.*, u.timezone
         FROM class_schedules cs
         JOIN users u ON u.id = cs.user_id
         WHERE cs.is_active = true`,
    );
    return result.rows as ScheduleWithTimezone[];
};
