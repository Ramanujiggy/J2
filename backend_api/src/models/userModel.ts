//model - talks to the database


import type { PoolClient } from 'pg';
import { query } from '../config/db.js';

// Executor interface — either the shared pool (via `query`) or a transaction client.
interface Executor {
    query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}
const defaultExec: Executor = { query };


export interface User { 
    id?: string; 
    email: string; 
    password_hash: string;
    belt_rank?: string; 
    created_at?: Date;
}

//logic to find a user, used during login or to check for existing email during registration. 
export const findUserByEmail = async (email: string): Promise<User | null> => {
    const result = await query('SELECT * FROM users WHERE email = $1', [email]); 
    return result.rows[0] || null; 
}; 


//logic to save a new user to supabase
export const createUser = async (email: string, passwordHash: string): Promise<User> => {
    const result = await query (
        'INSERT INTO users (email, password_hash) Values ($1, $2) RETURNING id, email, created_at', [email,passwordHash]
    );
    return result.rows[0];
};

// update a user's password hash — used during password reset.
// Accepts an optional transaction client so the password update + token-marked-used
// can run atomically in a single transaction.
export const updatePasswordHash = async (id: string, passwordHash: string, exec: Executor | PoolClient = defaultExec): Promise<void> => {
    await exec.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
};

// Update a user's IANA timezone (e.g. "America/Los_Angeles"). Synced from the
// client on first load. Used by the notification scheduler to convert UTC ticks
// into user-local clock for matching against class_schedules.start_time.
export const updateUserTimezone = async (id: string, timezone: string): Promise<void> => {
    await query('UPDATE users SET timezone = $1 WHERE id = $2', [timezone, id]);
};