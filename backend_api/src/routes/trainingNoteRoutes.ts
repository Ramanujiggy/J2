import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import { list, create, update, remove } from '../controllers/trainingNoteController.js';

const router = Router();

router.get('/', verifyToken, list);
router.post('/', verifyToken, create);
router.put('/:id', verifyToken, update);
router.delete('/:id', verifyToken, remove);

export default router;
