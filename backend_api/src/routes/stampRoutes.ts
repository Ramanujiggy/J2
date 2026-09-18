import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { listStamps, strikeStampHandler } from '../controllers/stampController.js';

const router = Router();

router.get('/', verifyToken, listStamps);
router.post('/', verifyToken, strikeStampHandler);

export default router;
