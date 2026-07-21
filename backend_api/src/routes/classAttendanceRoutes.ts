import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
    getAttendance,
    putAttendance,
    importAttendance,
} from '../controllers/classAttendanceController.js';

const router = Router();

router.get('/', verifyToken, getAttendance);
router.put('/', verifyToken, putAttendance);
router.post('/import', verifyToken, importAttendance);

export default router;
