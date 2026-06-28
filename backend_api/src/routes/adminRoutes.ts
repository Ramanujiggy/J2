import { Router } from 'express';
import { verifyToken, requireAdmin } from '../middleware/authMiddleware.js';
import {
    getStats,
    getCases,
    patchCase,
    getUsers,
    getUserDetail,
    getRecentLogins,
    cleanupOrphanedVideos,
    getFileTree,
    getRoutes,
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

// App structure X-ray — file tree + API route listing.
router.get('/structure/files',  getFileTree);
router.get('/structure/routes', getRoutes);

// One-off cleanup — walks R2 against user_tags storage keys, reports
// orphans. ?execute=true to actually delete. Defaults to dry-run.
router.post('/cleanup-orphaned-videos', cleanupOrphanedVideos);

export default router;
