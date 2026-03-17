import { query } from '../config/db.js';

export interface PasswordResetToken {
    id: string;
    user_id: string;
    token: string;
    expires_at: Date;
    used: boolean;
    created_at: Date;
}

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
export const findValidToken = async (token: string): Promise<PasswordResetToken | null> => {
    const result = await query(
        'SELECT * FROM password_reset_tokens WHERE token = $1 AND used = false AND expires_at > NOW()',
        [token]
    );
    return result.rows[0] || null;
};

// mark a token as used so it cannot be reused
export const markTokenUsed = async (id: string): Promise<void> => {
    await query('UPDATE password_reset_tokens SET used = true WHERE id = $1', [id]);
};
