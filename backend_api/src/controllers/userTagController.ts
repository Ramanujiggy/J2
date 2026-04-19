import type { Request, Response } from 'express';
import * as userTagModel from '../models/userTagModel.js';

const VALID_PILLARS = new Set(['standup', 'passing', 'pins', 'submissions', 'guard']);

function validateName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 50) return null;
  return trimmed;
}

// GET /api/user-tags — list all tags for the current user
export const getUserTags = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const tags = await userTagModel.getUserTags(userId);
    res.status(200).json({ tags });
  } catch (error) {
    console.error('❌ Error fetching user tags:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/user-tags — create a new tag, or return existing on name conflict.
// Idempotent and atomic: concurrent calls with the same name resolve to the
// same row (no race condition between exists-check and insert).
// Body: { name: string, parent_pillar: string }
export const createUserTag = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, parent_pillar } = req.body;

    const cleanName = validateName(name);
    if (!cleanName) {
      return res.status(400).json({ message: 'name must be a string between 1 and 50 characters.' });
    }
    if (!VALID_PILLARS.has(parent_pillar)) {
      return res.status(400).json({ message: 'parent_pillar must be a valid pillar.' });
    }

    const { tag, created } = await userTagModel.upsertUserTag(userId, cleanName, parent_pillar);
    res.status(created ? 201 : 200).json({ tag });
  } catch (error) {
    console.error('❌ Error creating user tag:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/user-tags/:id — update name and/or parent_pillar
// Body: { name?: string, parent_pillar?: string }
export const updateUserTag = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });
    const { name, parent_pillar } = req.body;

    let cleanName: string | null = null;
    if (name !== undefined) {
      cleanName = validateName(name);
      if (!cleanName) {
        return res.status(400).json({ message: 'name must be a string between 1 and 50 characters.' });
      }
    }

    let cleanPillar: string | null = null;
    if (parent_pillar !== undefined) {
      if (!VALID_PILLARS.has(parent_pillar)) {
        return res.status(400).json({ message: 'parent_pillar must be a valid pillar.' });
      }
      cleanPillar = parent_pillar;
    }

    const tag = await userTagModel.updateUserTag(userId, id, cleanName, cleanPillar);
    if (!tag) return res.status(404).json({ message: 'Tag not found.' });
    res.status(200).json({ tag });
  } catch (error) {
    console.error('❌ Error updating user tag:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// PATCH /api/user-tags/:id/video — update video metadata (Move Library, migration 010)
// The actual video file is stored client-side (OPFS / IndexedDB) — this endpoint
// only persists the small thumbnail + duration + notes that should sync.
// Body: { has_video?, video_thumbnail?, video_duration_seconds?, video_notes? }
//   - any field omitted is left unchanged
//   - any field passed as null clears it (e.g. removing video clears thumbnail)
const MAX_THUMBNAIL_BYTES = 32 * 1024; // ~32KB cap on data URL string
const MAX_VIDEO_NOTES_LENGTH = 1000;
const MAX_VIDEO_DURATION_SECONDS = 600;

export const updateUserTagVideo = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });

    const { has_video, video_thumbnail, video_duration_seconds, video_notes } = req.body;
    const patch: Parameters<typeof userTagModel.updateUserTagVideo>[2] = {};

    if (has_video !== undefined) {
      if (typeof has_video !== 'boolean') {
        return res.status(400).json({ message: 'has_video must be a boolean.' });
      }
      patch.has_video = has_video;
    }

    if (video_thumbnail !== undefined) {
      if (video_thumbnail !== null) {
        if (typeof video_thumbnail !== 'string') {
          return res.status(400).json({ message: 'video_thumbnail must be a data URL string or null.' });
        }
        if (video_thumbnail.length > MAX_THUMBNAIL_BYTES) {
          return res.status(400).json({ message: `video_thumbnail must be ≤ ${MAX_THUMBNAIL_BYTES} bytes (got ${video_thumbnail.length}).` });
        }
        if (!video_thumbnail.startsWith('data:image/')) {
          return res.status(400).json({ message: 'video_thumbnail must be a data:image/* URL.' });
        }
      }
      patch.video_thumbnail = video_thumbnail;
    }

    if (video_duration_seconds !== undefined) {
      if (video_duration_seconds !== null) {
        const n = Number(video_duration_seconds);
        if (!Number.isFinite(n) || n < 0 || n > MAX_VIDEO_DURATION_SECONDS) {
          return res.status(400).json({ message: `video_duration_seconds must be between 0 and ${MAX_VIDEO_DURATION_SECONDS}.` });
        }
        patch.video_duration_seconds = Math.round(n);
      } else {
        patch.video_duration_seconds = null;
      }
    }

    if (video_notes !== undefined) {
      if (video_notes !== null) {
        if (typeof video_notes !== 'string') {
          return res.status(400).json({ message: 'video_notes must be a string or null.' });
        }
        if (video_notes.length > MAX_VIDEO_NOTES_LENGTH) {
          return res.status(400).json({ message: `video_notes must be ≤ ${MAX_VIDEO_NOTES_LENGTH} characters.` });
        }
      }
      patch.video_notes = video_notes;
    }

    if (Object.keys(patch).length === 0) {
      return res.status(400).json({ message: 'No video fields provided.' });
    }

    const tag = await userTagModel.updateUserTagVideo(userId, id, patch);
    if (!tag) return res.status(404).json({ message: 'Tag not found.' });
    res.status(200).json({ tag });
  } catch (error) {
    console.error('❌ Error updating user tag video:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/user-tags/:id
export const deleteUserTag = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });
    const ok = await userTagModel.deleteUserTag(userId, id);
    if (!ok) return res.status(404).json({ message: 'Tag not found.' });
    res.status(200).json({ message: 'Tag deleted.' });
  } catch (error) {
    console.error('❌ Error deleting user tag:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
