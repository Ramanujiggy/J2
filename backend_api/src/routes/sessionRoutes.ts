import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { logSession, getSessions } from '../controllers/sessionController.js';

const router = Router();

// POST /api/sessions — log a new training session (protected)
router.post('/sessions', verifyToken, logSession);

// GET /api/sessions — fetch all sessions for the logged-in user (protected)
router.get('/sessions', verifyToken, getSessions);

export default router;
