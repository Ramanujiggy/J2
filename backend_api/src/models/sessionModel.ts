import { query } from '../config/db.js';
import pool from '../config/db.js';

export interface Session {
    id?: string;
    user_id: string;
    date: string;
    duration: number;
    notes?: string;
    gi_nogi: 'gi' | 'no_gi';
    intensity: number;
    session_type: 'drilling' | 'class' | 'competition_training';
    tags: string[];
    heading?: string | null;
    polarity?: 'offense' | 'defense' | 'neutral' | null;
    sub_skill_tag?: string | null;
    script_source?: 'directed' | 'organic' | null;
    resonance?: number | null;
    created_at?: Date;
}

export const createSession = async (
    userId: string,
    date: string,
    duration: number,
    notes: string,
    gi_nogi: 'gi' | 'no_gi',
    intensity: number,
    session_type: 'drilling' | 'class' | 'competition_training',
    tags: string[],
    heading: string | null,
    polarity: string | null,
    sub_skill_tag: string | null,
    script_source: string | null,
    resonance: number | null,
): Promise<Session & { session_count: number }> => {
    const result = await query(
        `WITH new_session AS (
           INSERT INTO training_sessions
           (user_id, date, duration, notes, gi_nogi, intensity, session_type, tags,
            heading, polarity, sub_skill_tag, script_source, resonance)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
           RETURNING *
         )
         SELECT ns.*, (SELECT COUNT(*)::int FROM training_sessions WHERE user_id = $1) AS session_count
         FROM new_session ns`,
        [userId, date, duration, notes || null, gi_nogi, intensity, session_type, tags,
         heading, polarity, sub_skill_tag, script_source, resonance],
    );
    return result.rows[0];
};

export const getSessionsByUser = async (userId: string, from?: string, to?: string): Promise<Session[]> => {
    const params: unknown[] = [userId];
    let whereExtra = '';
    if (from) { params.push(from); whereExtra += ` AND date >= $${params.length}`; }
    if (to)   { params.push(to);   whereExtra += ` AND date <= $${params.length}`; }
    const result = await query(
        `SELECT * FROM training_sessions WHERE user_id = $1${whereExtra} ORDER BY date DESC`,
        params,
    );
    return result.rows;
};

export const deleteSession = async (id: string, userId: string): Promise<boolean> => {
    const result = await query(
        'DELETE FROM training_sessions WHERE id = $1 AND user_id = $2',
        [id, userId],
    );
    return (result.rowCount ?? 0) > 0;
};

export interface BulkSessionInput {
    date: string;
    duration: number;
    gi_nogi: 'gi' | 'no_gi';
    intensity: number;
    session_type: 'drilling' | 'class' | 'competition_training';
    tags: string[];
    notes: string;
    heading?: string | null;
    polarity?: string | null;
    sub_skill_tag?: string | null;
    script_source?: string | null;
    resonance?: number | null;
}

export const bulkInsertSessions = async (userId: string, sessions: BulkSessionInput[]): Promise<number> => {
    if (sessions.length === 0) return 0;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Build multi-row parameterized INSERT
        const valuePlaceholders: string[] = [];
        const flatParams: unknown[] = [];
        let paramIdx = 1;

        for (const s of sessions) {
            valuePlaceholders.push(
                `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`,
            );
            flatParams.push(
                userId, s.date, s.duration, s.notes || null, s.gi_nogi, s.intensity, s.session_type, s.tags,
                s.heading ?? null, s.polarity ?? null, s.sub_skill_tag ?? null, s.script_source ?? null, s.resonance ?? null,
            );
        }

        await client.query(
            `INSERT INTO training_sessions (user_id, date, duration, notes, gi_nogi, intensity, session_type, tags,
                                            heading, polarity, sub_skill_tag, script_source, resonance)
             VALUES ${valuePlaceholders.join(', ')}`,
            flatParams,
        );

        await client.query('COMMIT');
        return sessions.length;
    } catch (err) {
        await client.query('ROLLBACK');
        throw err;
    } finally {
        client.release();
    }
};

export const updateSession = async (
    id: string,
    userId: string,
    duration: number,
    gi_nogi: 'gi' | 'no_gi',
    intensity: number,
    session_type: 'drilling' | 'class' | 'competition_training',
    notes: string,
    tags: string[],
    heading: string | null,
    polarity: string | null,
    sub_skill_tag: string | null,
    script_source: string | null,
    resonance: number | null,
): Promise<Session | null> => {
    const result = await query(
        `UPDATE training_sessions
         SET duration = $3, gi_nogi = $4, intensity = $5, session_type = $6, notes = $7, tags = $8,
             heading = $9, polarity = $10, sub_skill_tag = $11, script_source = $12, resonance = $13
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, userId, duration, gi_nogi, intensity, session_type, notes || null, tags,
         heading, polarity, sub_skill_tag, script_source, resonance],
    );
    return result.rows[0] ?? null;
};
