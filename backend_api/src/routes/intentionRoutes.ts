import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  createIntention,
  getIntentions,
  getCurrentIntention,
  deleteIntention,
} from '../controllers/intentionController.js';

const router = Router();

// All intention routes require authentication
router.use(verifyToken);

router.post('/',        createIntention);
router.get('/',         getIntentions);
router.get('/current',  getCurrentIntention);
router.delete('/:id',   deleteIntention);

export default router;
