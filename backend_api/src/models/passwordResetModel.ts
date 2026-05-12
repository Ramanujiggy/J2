import type { PoolClient } from 'pg';
import { query } from '../config/db.js';

export interface PasswordResetToken {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    used: boolean;
    created_at: Date;
}

// Executor interface — either the shared pool (via `query`) or a transaction client.
// Allows these model functions to participate in a caller-managed transaction.
interface Executor {
    query: (text: string, params?: unknown[]) => Promise<{ rows: PasswordResetToken[] | { id: string }[] | unknown[]; rowCount: number | null }>;
}
const defaultExec: Executor = { query };

// store a new reset token for a user
export const createResetToken = async (
    userId: string,
    token: string,
    expiresAt: Date
): Promise<void> => {
    await query(
        'INSERT INTO password_reset_tokens (user_id, token, expires_at) VALUES ($1, $2, $3)',
        [userId, token, expiresAt]
    );
};

// look up a token only if it exists, is not expired, and has not been used
export const findValidToken = async (token: string, exec: Executor | PoolClient = defaultExec): Promise<PasswordResetToken | null> => {
    const result = await exec.query(
        'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
        [token]
    );
    return (result.rows[0] as PasswordResetToken | undefined) ?? null;
};

// mark a token as used so it cannot be reused
export const markTokenUsed = async (id: string, exec: Executor | PoolClient = defaultExec): Promise<void> => {
    await exec.query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [id]);
};
