import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { logSession, getSessions, updateSession, importSessions } from '../controllers/sessionController.js';

const router = Router();

// POST /api/sessions — log a new training session (protected)
router.post('/sessions', verifyToken, logSession);

// GET /api/sessions — fetch all sessions for the logged-in user (protected)
router.get('/sessions', verifyToken, getSessions);

// PUT /api/sessions/:id — update an existing session (protected)
router.put('/sessions/:id', verifyToken, updateSession);

// POST /api/sessions/import — bulk import sessions from CSV (protected)
router.post('/sessions/import', verifyToken, importSessions);

export default router;
