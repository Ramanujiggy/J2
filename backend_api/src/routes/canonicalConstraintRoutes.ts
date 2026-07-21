import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { getCanonicalConstraints } from '../controllers/canonicalConstraintController.js';

const router = Router();
router.use(verifyToken);

router.get('/', getCanonicalConstraints);

export default router;
