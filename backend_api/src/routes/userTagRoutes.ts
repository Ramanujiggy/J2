import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
  getUserTags,
  createUserTag,
  updateUserTag,
  updateUserTagVideo,
  deleteUserTag,
  promoteCanonicalToUserTag,
  // Move Library v2 (mig 028) — cloud video endpoints
  mintVideoUploadUrl,
  completeVideoUpload,
  getVideoPlaybackUrl,
  retryVideoTranscode,
  removeVideo,
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
// Move Library v2 cloud video endpoints (mig 028). Order matters: these are
// nested under :id so they go AFTER the broad PATCH /:id routes but BEFORE
// the DELETE /:id terminal — Express matches in declaration order.
router.post('/:id/video/upload-url',      mintVideoUploadUrl);
router.post('/:id/video/upload-complete', completeVideoUpload);
router.get('/:id/video/url',              getVideoPlaybackUrl);
router.post('/:id/video/retry',           retryVideoTranscode);
router.delete('/:id/video',               removeVideo);
router.delete('/:id',                     deleteUserTag);

export default router;
