import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
    listClassSchedules,
    createClassSchedule,
    updateClassSchedule,
    deleteClassSchedule,
} from '../controllers/classScheduleController.js';

const router = Router();

router.get('/', verifyToken, listClassSchedules);
router.post('/', verifyToken, createClassSchedule);
router.patch('/:id', verifyToken, updateClassSchedule);
router.delete('/:id', verifyToken, deleteClassSchedule);

export default router;
