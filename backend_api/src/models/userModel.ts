//model - talks to the database


import { query } from '../config/db.js';


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

// find a user by their id — used after validating a password reset token
export const findUserById = async (id: string): Promise<User | null> => {
    const result = await query('SELECT * FROM users WHERE id = $1', [id]);
    return result.rows[0] || null;
};

// update a user's password hash — used during password reset
export const updatePasswordHash = async (id: string, passwordHash: string): Promise<void> => {
    await query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, id]);
};