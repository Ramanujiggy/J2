import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  getUserTags,
  createUserTag,
  updateUserTag,
  updateUserTagVideo,
  deleteUserTag,
  promoteCanonicalToUserTag,
} from '../controllers/userTagController.js';

const router = Router();
router.use(verifyToken);

router.get('/',                       getUserTags);
router.post('/',                      createUserTag);
// Idempotent fork of a canonical position into the user's personal library.
// Mounted before `:id` patterns so the literal path takes precedence.
router.post('/promote-canonical',     promoteCanonicalToUserTag);
router.patch('/:id',                  updateUserTag);
router.patch('/:id/video',            updateUserTagVideo);
router.delete('/:id',                 deleteUserTag);

export default router;
