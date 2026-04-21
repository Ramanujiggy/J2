import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getCanonicalPositions } from '../controllers/canonicalPositionController.js';

const router = Router();
router.use(verifyToken);

router.get('/', getCanonicalPositions);

export default router;
