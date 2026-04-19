import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  getUserTags,
  createUserTag,
  updateUserTag,
  updateUserTagVideo,
  deleteUserTag,
} from '../controllers/userTagController.js';

const router = Router();
router.use(verifyToken);

router.get('/',             getUserTags);
router.post('/',            createUserTag);
router.patch('/:id',        updateUserTag);
router.patch('/:id/video',  updateUserTagVideo);
router.delete('/:id',       deleteUserTag);

export default router;
