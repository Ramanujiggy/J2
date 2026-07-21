import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { submitCase } from '../controllers/supportCaseController.js';

const router = Router();
router.use(verifyToken);

// POST /api/cases — any authed user can submit a support case from the
// "Report a Problem" modal in their profile.
router.post('/', submitCase);

export default router;
