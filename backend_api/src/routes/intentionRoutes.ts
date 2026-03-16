import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  createIntention,
  getIntentions,
  getCurrentIntention,
  deleteIntention,
  patchJournalEntry,
} from '../controllers/intentionController.js';

const router = Router();

// All intention routes require authentication
router.use(verifyToken);

router.post('/',        createIntention);
router.get('/',         getIntentions);
router.get('/current',  getCurrentIntention);
router.delete('/:id',          deleteIntention);
router.patch('/:id/journal',   patchJournalEntry);

export default router;
