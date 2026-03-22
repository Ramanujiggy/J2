import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { logSession, getSessions, updateSession, deleteSession } from '../controllers/sessionController.js';

const router = Router();

// POST /api/sessions — log a new training session (protected)
router.post('/sessions', verifyToken, logSession);

// GET /api/sessions — fetch all sessions for the logged-in user (protected)
router.get('/sessions', verifyToken, getSessions);

// PUT /api/sessions/:id — update an existing session (protected)
router.put('/sessions/:id', verifyToken, updateSession);

// DELETE /api/sessions/:id — delete a session (protected, ownership enforced)
router.delete('/sessions/:id', verifyToken, deleteSession);

export default router;
