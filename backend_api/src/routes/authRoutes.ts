// Routes - maps HTTP verbs + paths to controller functions
// Auth routes are public (no verifyToken) — they are how a user gets a token in the first place

import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, requestPasswordReset, resetPassword } from '../controllers/authcontroller.js';

const router = Router();

// Rate limiter: max 10 auth attempts per 15 minutes per IP
// Protects against brute-force attacks on login and register
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10,
    message: { message: 'Too many attempts. Please try again in 15 minutes.' },
    standardHeaders: true,  // sends RateLimit-* headers in the response
    legacyHeaders: false,
});

// POST /auth/register
router.post('/register', authLimiter, register);

// POST /auth/login
router.post('/login', authLimiter, login);

// POST /auth/request-password-reset
router.post('/request-password-reset', authLimiter, requestPasswordReset);

// POST /auth/reset-password
router.post('/reset-password', authLimiter, resetPassword);

export default router;
