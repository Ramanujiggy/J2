import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { listBeltHistory, createBeltHistory, deleteBeltHistory } from '../controllers/beltHistoryController.js';

const router = Router();

router.get('/', verifyToken, listBeltHistory);
router.post('/', verifyToken, createBeltHistory);
router.delete('/:id', verifyToken, deleteBeltHistory);

export default router;
