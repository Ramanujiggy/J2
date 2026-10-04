import type { Request, Response } from 'express';
import * as sessionVideoModel from '../models/sessionVideoModel.js';
import * as r2 from '../lib/r2Client.js';

const MAX_VIDEO_BYTES = 500 * 1024 * 1024; // 500 MB cap for rolling footage
const ACCEPTED_VIDEO_PREFIXES = ['video/'];

// ── Upload flow ────────────────────────────────────────────────────────────

export const mintVideoUploadUrl = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { sessionId } = req.params;

        const { content_type, ext } = req.body ?? {};
        if (typeof content_type !== 'string' || !ACCEPTED_VIDEO_PREFIXES.some(p => content_type.startsWith(p))) {
            return res.status(400).json({ message: 'content_type must be a video/* MIME type.' });
        }
        if (typeof ext !== 'string' || ext.length < 1 || ext.length > 8) {
            return res.status(400).json({ message: 'ext must be a short file extension string.' });
        }

        // Create the session_videos row first so we have a stable id for the storage key.
        const video = await sessionVideoModel.createSessionVideo(userId, sessionId);
        const storageKey = r2.rawSessionVideoKey(userId, video.id, ext);
        const { uploadUrl, expiresAt } = await r2.mintPutUrl(storageKey, content_type);

        res.status(200).json({ videoId: video.id, uploadUrl, storageKey, expiresAt });
    } catch (err) {
        console.error('❌ Error minting session video upload URL:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const completeVideoUpload = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { videoId } = req.params;

        const { raw_storage_key, byte_size, video_thumbnail, video_duration_seconds } = req.body ?? {};

        if (typeof raw_storage_key !== 'string' || !r2.verifySessionVideoKeyOwnedBy(raw_storage_key, userId)) {
            return res.status(400).json({ message: 'Invalid raw_storage_key.' });
        }
        if (typeof byte_size !== 'number' || !Number.isFinite(byte_size) || byte_size <= 0) {
            return res.status(400).json({ message: 'byte_size must be a positive number.' });
        }
        if (byte_size > MAX_VIDEO_BYTES) {
            return res.status(413).json({ message: `Video exceeds ${MAX_VIDEO_BYTES / 1024 / 1024}MB cap.` });
        }
        if (video_thumbnail !== null && video_thumbnail !== undefined && typeof video_thumbnail !== 'string') {
            return res.status(400).json({ message: 'video_thumbnail must be a string or null.' });
        }
        if (video_duration_seconds != null && typeof video_duration_seconds !== 'number') {
            return res.status(400).json({ message: 'video_duration_seconds must be a number or null.' });
        }

        const video = await sessionVideoModel.recordRawUpload(userId, videoId, {
            raw_storage_key,
            byte_size,
            video_thumbnail: video_thumbnail ?? null,
            video_duration_seconds: video_duration_seconds ?? null,
        });
        if (!video) return res.status(404).json({ message: 'Video not found.' });

        res.status(200).json({ video });
    } catch (err) {
        console.error('❌ Error completing session video upload:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ── Playback ──────────────────────────────────────────────────────────────

export const listVideos = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { sessionId } = req.params;
        const videos = await sessionVideoModel.listSessionVideos(userId, sessionId);
        res.status(200).json({ videos });
    } catch (err) {
        console.error('❌ Error listing session videos:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const getVideoPlaybackUrl = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { videoId } = req.params;

        const video = await sessionVideoModel.findSessionVideoById(userId, videoId);
        if (!video) return res.status(404).json({ message: 'Video not found.' });

        const status = video.video_status ?? null;
        if (!status) return res.status(200).json({ status: null });
        if (status === 'failed') return res.status(200).json({ status: 'failed', message: video.video_status_message ?? null });
        if (status === 'processing' || !video.video_storage_key) return res.status(200).json({ status: 'processing' });

        const { url, expiresAt } = await r2.mintGetUrl(video.video_storage_key);
        res.status(200).json({ status: 'ready', url, expiresAt });
    } catch (err) {
        console.error('❌ Error minting session video playback URL:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ── Retry + delete ────────────────────────────────────────────────────────

export const retryVideoTranscode = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { videoId } = req.params;
        const video = await sessionVideoModel.requeueFailedTranscode(userId, videoId);
        if (!video) return res.status(404).json({ message: 'Video not found or not retryable.' });
        res.status(200).json({ video });
    } catch (err) {
        console.error('❌ Error retrying session video transcode:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const deleteVideo = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { videoId } = req.params;
        const result = await sessionVideoModel.deleteSessionVideo(userId, videoId);
        if (!result) return res.status(404).json({ message: 'Video not found.' });
        // Best-effort R2 cleanup.
        if (result.rawKey) r2.deleteObject(result.rawKey).catch(() => {});
        if (result.encodedKey) r2.deleteObject(result.encodedKey).catch(() => {});
        res.status(200).json({ ok: true });
    } catch (err) {
        console.error('❌ Error deleting session video:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

// ── Position segments ──────────────────────────────────────────────────────

export const getSegments = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { videoId } = req.params;
        const segments = await sessionVideoModel.getSegments(userId, videoId);
        res.status(200).json({ segments });
    } catch (err) {
        console.error('❌ Error fetching position segments:', err);
        res.status(500).json({ message: 'Server error' });
    }
};

export const saveSegments = async (req: Request, res: Response) => {
    try {
        const userId = req.user!.id;
        const { videoId } = req.params;

        // Verify ownership.
        const video = await sessionVideoModel.findSessionVideoById(userId, videoId);
        if (!video) return res.status(404).json({ message: 'Video not found.' });

        const { segments } = req.body ?? {};
        if (!Array.isArray(segments)) return res.status(400).json({ message: 'segments must be an array.' });

        for (const s of segments) {
            if (typeof s.start_sec !== 'number' || typeof s.end_sec !== 'number' || typeof s.position_label !== 'string') {
                return res.status(400).json({ message: 'Each segment needs start_sec, end_sec, position_label.' });
            }
            if (s.end_sec <= s.start_sec) {
                return res.status(400).json({ message: 'end_sec must be greater than start_sec.' });
            }
        }

        const saved = await sessionVideoModel.replaceSegments(userId, videoId, segments);
        res.status(200).json({ segments: saved });
    } catch (err) {
        console.error('❌ Error saving position segments:', err);
        res.status(500).json({ message: 'Server error' });
    }
};
