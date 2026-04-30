import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { fetchProfile, saveProfile, saveTimezone } from '../controllers/profileController.js';

const router = Router();

// GET /api/profile — get the current user's profile (protected)
router.get('/profile', verifyToken, fetchProfile);

// PUT /api/profile — save the current user's profile (protected)
router.put('/profile', verifyToken, saveProfile);

// PATCH /api/profile/timezone — sync the user's IANA timezone (protected)
router.patch('/profile/timezone', verifyToken, saveTimezone);

export default router;
