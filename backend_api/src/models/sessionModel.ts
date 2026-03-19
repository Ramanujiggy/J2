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
    tags: string[]
): Promise<Session> => {
    const result = await query(
        'INSERT INTO training_sessions (user_id, date, duration, notes, gi_nogi, intensity, session_type, tags) VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *',
        [userId, date, duration, notes || null, gi_nogi, intensity, session_type, tags]
    );
    return result.rows[0];
};

export const getSessionsByUser = async (userId: string): Promise<Session[]> => {
    const result = await query(
        'SELECT * FROM training_sessions WHERE user_id = $1 ORDER BY date DESC',
        [userId]
    );
    return result.rows;
};

export interface BulkSessionInput {
    date: string;
    duration: number;
    gi_nogi: 'gi' | 'no_gi';
    intensity: number;
    session_type: 'drilling' | 'class' | 'competition_training';
    tags: string[];
    notes: string;
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
                `($${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++}, $${paramIdx++})`
            );
            flatParams.push(userId, s.date, s.duration, s.notes || null, s.gi_nogi, s.intensity, s.session_type, s.tags);
        }

        await client.query(
            `INSERT INTO training_sessions (user_id, date, duration, notes, gi_nogi, intensity, session_type, tags)
             VALUES ${valuePlaceholders.join(', ')}`,
            flatParams
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
    tags: string[]
): Promise<Session | null> => {
    const result = await query(
        `UPDATE training_sessions
         SET duration = $3, gi_nogi = $4, intensity = $5, session_type = $6, notes = $7, tags = $8
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, userId, duration, gi_nogi, intensity, session_type, notes || null, tags]
    );
    return result.rows[0] ?? null;
};
