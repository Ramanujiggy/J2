import { query } from '../config/db.js';

export interface Session {
    id?: string;
    user_id: string;
    date: string;
    duration: number;
    notes?: string;
    gi_nogi: 'gi' | 'no_gi';
    intensity: number;
    session_type: 'drilling' | 'class' | 'competition_training';
    created_at?: Date;
}

export const createSession = async (
    userId: string,
    date: string,
    duration: number,
    notes: string,
    gi_nogi: 'gi' | 'no_gi',
    intensity: number,
    session_type: 'drilling' | 'class' | 'competition_training'
): Promise<Session> => {
    const result = await query(
        'INSERT INTO training_sessions (user_id, date, duration, notes, gi_nogi, intensity, session_type) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *',
        [userId, date, duration, notes || null, gi_nogi, intensity, session_type]
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

export const updateSession = async (
    id: string,
    userId: string,
    duration: number,
    gi_nogi: 'gi' | 'no_gi',
    intensity: number,
    session_type: 'drilling' | 'class' | 'competition_training',
    notes: string
): Promise<Session | null> => {
    const result = await query(
        `UPDATE training_sessions
         SET duration = $3, gi_nogi = $4, intensity = $5, session_type = $6, notes = $7
         WHERE id = $1 AND user_id = $2
         RETURNING *`,
        [id, userId, duration, gi_nogi, intensity, session_type, notes || null]
    );
    return result.rows[0] ?? null;
};
