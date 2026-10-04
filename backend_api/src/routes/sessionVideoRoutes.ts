import { Router } from 'express';
import { verifyToken } from '../middleware/authMiddleware.js';
import {
    listVideos,
    mintVideoUploadUrl,
    completeVideoUpload,
    getVideoPlaybackUrl,
    retryVideoTranscode,
    deleteVideo,
    getSegments,
    saveSegments,
} from '../controllers/sessionVideoController.js';

const router = Router({ mergeParams: true });
router.use(verifyToken);

// Videos for a session
router.get('/',                             listVideos);
router.post('/upload-url',                  mintVideoUploadUrl);

// Per-video operations (videoId param)
router.post('/:videoId/upload-complete',    completeVideoUpload);
router.get('/:videoId/url',                 getVideoPlaybackUrl);
router.post('/:videoId/retry',              retryVideoTranscode);
router.delete('/:videoId',                  deleteVideo);

// Position segments
router.get('/:videoId/segments',            getSegments);
router.put('/:videoId/segments',            saveSegments);

export default router;
