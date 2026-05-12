// Middleware - sits between the route and the controller.
// Verifies the JWT on any protected route before letting the request through.

import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { query } from '../config/db.js';


// The shape of the payload we sign into the token
interface TokenPayload {
    id: string;
    email: string;
}

// Extend Express's Request type so controllers can access req.user
declare global {
    namespace Express {
        interface Request {
            user?: TokenPayload;
        }
    }
}


export const verifyToken = (req: Request, res: Response, next: NextFunction): void => {
    try {
        // Expect header format: "Authorization: Bearer <token>"
        const authHeader = req.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            res.status(401).json({ message: 'Access denied. No token provided.' });
            return;
        }

        const token = authHeader.split(' ')[1];

        if (!token) {
            res.status(401).json({ message: 'Access denied. Token missing.' });
            return;
        }

        // Pull the secret from environment — fail loudly if it's missing
        const secret = process.env.JWT_SECRET;
        if (!secret) {
            console.error('❌ JWT_SECRET is not set in environment variables');
            res.status(500).json({ message: 'Server configuration error' });
            return;
        }

        // Verify the token and attach the decoded payload to the request
        const decoded = jwt.verify(token, secret) as TokenPayload;
        req.user = decoded;
        next();

    } catch (error) {
        if (error instanceof jwt.TokenExpiredError) {
            res.status(401).json({ message: 'Token expired. Please log in again.' });
            return;
        }

        if (error instanceof jwt.JsonWebTokenError) {
            res.status(401).json({ message: 'Invalid token.' });
            return;
        }

        console.error('❌ Error during token verification:', error);
        res.status(500).json({ message: 'Server error' });
    }
};

// requireAdmin — chained AFTER verifyToken on admin-only routes. Looks up
// users.is_admin (mig 023) and rejects with 403 if the flag is false.
export const requireAdmin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
        const userId = req.user?.id;
        if (!userId) {
            res.status(401).json({ message: 'Unauthorized.' });
            return;
        }
        const result = await query(
            'SELECT is_admin FROM users WHERE id = $1',
            [userId]
        );
        const row = result.rows[0] as { is_admin: boolean } | undefined;
        if (!row?.is_admin) {
            res.status(403).json({ message: 'Admin access required.' });
            return;
        }
        next();
    } catch (error) {
        console.error('❌ Error during admin check:', error);
        res.status(500).json({ message: 'Server error' });
    }
};
