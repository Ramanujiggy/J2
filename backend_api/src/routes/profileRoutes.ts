import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { fetchProfile, saveProfile } from '../controllers/profileController.js';

const router = Router();

// GET /api/profile — get the current user's profile (protected)
router.get('/profile', verifyToken, fetchProfile);

// PUT /api/profile — save the current user's profile (protected)
router.put('/profile', verifyToken, saveProfile);

export default router;
