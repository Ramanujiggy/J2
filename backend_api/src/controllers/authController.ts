// Controller- this talks to the user via requests and then feeds back to the model

import type { Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import pool from '../config/db.js';
import * as userModel from '../models/userModel.js';
import * as passwordResetModel from '../models/passwordResetModel.js';
import { sendPasswordResetEmail } from '../services/emailService.js';

// Simple email format guard — catches obvious typos before they reach the DB
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const isValidEmail = (email: string) => EMAIL_RE.test(email);

// SHA-256 hash of a reset token — stored in DB so plaintext never persists
const hashToken = (token: string): string =>
    crypto.createHash('sha256').update(token).digest('hex');

// ---- Register ---------------------------------------------------------------

export const register = async (req: Request, res: Response) => {
    try {
        const { email: rawEmail, password } = req.body;

        //validation that email and password are provided
        if (!rawEmail || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const email = rawEmail.toLowerCase().trim();

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        // check if the user already exists, using the user model
        const existingUser = await userModel.findUserByEmail(email);
        if (existingUser) {
            return res.status(409).json({ message: 'User already exists' });
        }

        //Hardening: scrable the password using bcrypt
        const saltRounds = 12;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        //save the new user using the user model
        const newUser  = await userModel.createUser(email, hashedPassword);

        //success response
        res.status(201).json({ message: "User registered successfully.",
            user: {id: newUser.id, email: newUser.email}
        });

    } catch (error){
        console.error("❌ Error during user registration:", error);
        if (error instanceof Error && error.message.includes('unique')) {
            return res.status(409).json({ message: 'User already exists' });
        }
        res.status(500).json({ message: 'Server error' });
    }
};

// ---- Login ------------------------------------------------------------------

export const login = async (req: Request, res: Response) => {
    try {
        const { email: rawEmail, password } = req.body;

        // validation that email and password are provided
        if (!rawEmail || !password) {
            return res.status(400).json({ message: 'Email and password are required' });
        }

        const email = rawEmail.toLowerCase().trim();

        if (!isValidEmail(email)) {
            return res.status(400).json({ message: 'Please enter a valid email address.' });
        }

        // look up the user — return a generic message to avoid leaking whether the email exists
        const user = await userModel.findUserByEmail(email);
        if (!user || !user.id) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // compare the provided password against the stored hash
        const passwordMatch = await bcrypt.compare(password, user.password_hash);
        if (!passwordMatch) {
            return res.status(401).json({ message: 'Invalid email or password' });
        }

        // sign a JWT with the user's id and email as the payload
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('❌ JWT_SECRET is not set in environment variables');
            return res.status(500).json({ message: 'Server configuration error' });
        }

        const token = jwt.sign(
            { id: user.id, email: user.email },
            secret,
            { expiresIn: '24h' }
        );

        console.log('✅ User logged in:', user.email);

        res.status(200).json({
            message: 'Login successful',
            token,
            user: { id: user.id, email: user.email }
        });

    } catch (error) {
        console.error('❌ Error during login:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// ---- Request Password Reset -------------------------------------------------

export const requestPasswordReset = async (req: Request, res: Response) => {
    // Always return the same generic response to prevent user enumeration
    const genericResponse = { message: 'If that email exists, a reset link has been sent.' };

    try {
        const { email: rawEmail } = req.body;
        if (!rawEmail) return res.status(200).json(genericResponse);

        const email = rawEmail.toLowerCase().trim();

        // Invalid email format — return generic response (no user enumeration)
        if (!isValidEmail(email)) return res.status(200).json(genericResponse);

        const user = await userModel.findUserByEmail(email);

        if (user && user.id) {
            const token = crypto.randomBytes(32).toString('hex');
            const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour from now

            await passwordResetModel.createResetToken(user.id, hashToken(token), expiresAt);

            const frontendUrl = process.env.FRONTEND_URL ?? 'http://localhost:3000';
            const resetLink = `${frontendUrl}/reset-password?token=${token}`;

            await sendPasswordResetEmail(email, resetLink);
            console.log('✅ Password reset email sent to:', email);
        }

        return res.status(200).json(genericResponse);
    } catch (error) {
        console.error('❌ Error during password reset request:', error);
        // Still return generic response so errors don't leak info
        return res.status(200).json(genericResponse);
    }
};

// ---- Reset Password ---------------------------------------------------------

export const resetPassword = async (req: Request, res: Response) => {
    try {
        const { token, newPassword } = req.body;

        if (!token || !newPassword) {
            return res.status(400).json({ message: 'Token and new password are required.' });
        }

        if (newPassword.length < 8) {
            return res.status(400).json({ message: 'Password must be at least 8 characters.' });
        }

        // Transaction: locks the token row with FOR UPDATE so two requests carrying
        // the same reset link serialise. Without it both could read the token as
        // unused, and a failure after the password write would leave a live link.
        const client = await pool.connect();
        try {
            await client.query('BEGIN');

            const resetToken = await passwordResetModel.findValidToken(hashToken(token), client, true);
            if (!resetToken) {
                await client.query('ROLLBACK');
                return res.status(400).json({ message: 'This reset link is invalid or has expired.' });
            }

            const saltRounds = 12;
            const hashedPassword = await bcrypt.hash(newPassword, saltRounds);

            await userModel.updatePasswordHash(resetToken.user_id, hashedPassword, client);
            await passwordResetModel.markTokenUsed(resetToken.id, client);

            await client.query('COMMIT');
            console.log('✅ Password reset successfully for user:', resetToken.user_id);
            return res.status(200).json({ message: 'Password updated successfully.' });
        } catch (txErr) {
            await client.query('ROLLBACK').catch(() => {});
            throw txErr;
        } finally {
            client.release();
        }

    } catch (error) {
        console.error('❌ Error during password reset:', error);
        return res.status(500).json({ message: 'Server error' });
    }
};
