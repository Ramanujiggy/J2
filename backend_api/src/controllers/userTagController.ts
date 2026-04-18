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

// POST /api/user-tags — create a new tag, or return existing on name conflict
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

    // Idempotent: if a tag with this name already exists for this user, return it
    const existing = await userTagModel.findUserTagByName(userId, cleanName);
    if (existing) {
      return res.status(200).json({ tag: existing });
    }

    const tag = await userTagModel.createUserTag(userId, cleanName, parent_pillar);
    res.status(201).json({ tag });
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
