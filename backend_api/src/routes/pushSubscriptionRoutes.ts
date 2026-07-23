import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
    getPublicKey,
    subscribe,
    unsubscribe,
    updateCategories,
    getMySubscriptionState,
} from '../controllers/pushSubscriptionController.js';

const router = Router();

// Public — clients call this once before subscribing.
router.get('/vapid-public-key', getPublicKey);

router.get('/me', verifyToken, getMySubscriptionState);
router.post('/', verifyToken, subscribe);
router.patch('/categories', verifyToken, updateCategories);
router.delete('/', verifyToken, unsubscribe);

export default router;
