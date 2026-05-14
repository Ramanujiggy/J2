import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middleware/authMiddleware.js';
import {
    getStats,
    getCases,
    patchCase,
    getUsers,
    getUserDetail,
    getRecentLogins,
} from '../controllers/adminController.js';

const router = Router();
// Both layers — verifyToken proves the JWT, requireAdmin checks users.is_admin.
router.use(verifyToken);
router.use(requireAdmin);

router.get('/stats',          getStats);
router.get('/cases',          getCases);
router.patch('/cases/:id',    patchCase);
router.get('/users',          getUsers);
router.get('/users/:id',      getUserDetail);
router.get('/recent-logins',  getRecentLogins);

export default router;
