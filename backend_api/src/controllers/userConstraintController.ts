import type { Request, Response } from 'express';
import * as userConstraintModel from '../models/userConstraintModel.js';
import type { Pillar } from '../models/userConstraintModel.js';

const VALID_PILLARS = new Set<Pillar>(['standup', 'passing', 'pins', 'submissions', 'guard']);

function validateName(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (trimmed.length < 1 || trimmed.length > 100) return null;
  return trimmed;
}

// GET /api/user-constraints — list all constraints for the current user
export const getUserConstraints = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const constraints = await userConstraintModel.getUserConstraints(userId);
    res.status(200).json({ constraints });
  } catch (error) {
    console.error('❌ Error fetching user constraints:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// POST /api/user-constraints — create or upsert a constraint
// Body: { name: string, parent_pillar?: string | null }
//   parent_pillar is OPTIONAL/nullable — some constraints span multiple pillars.
export const createUserConstraint = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { name, parent_pillar } = req.body;

    const cleanName = validateName(name);
    if (!cleanName) {
      return res.status(400).json({ message: 'name must be a string between 1 and 100 characters.' });
    }

    let cleanPillar: Pillar | null = null;
    if (parent_pillar !== undefined && parent_pillar !== null) {
      if (typeof parent_pillar !== 'string' || !VALID_PILLARS.has(parent_pillar as Pillar)) {
        return res.status(400).json({ message: 'parent_pillar must be a valid pillar or null.' });
      }
      cleanPillar = parent_pillar as Pillar;
    }

    const { constraint, created } = await userConstraintModel.upsertUserConstraint(userId, cleanName, cleanPillar);
    res.status(created ? 201 : 200).json({ constraint });
  } catch (error) {
    console.error('❌ Error creating user constraint:', error);
    res.status(500).json({ message: 'Server error' });
  }
};

// DELETE /api/user-constraints/:id
export const deleteUserConstraint = async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { id } = req.params;
    if (!id) return res.status(400).json({ message: 'id is required.' });
    const ok = await userConstraintModel.deleteUserConstraint(userId, id);
    if (!ok) return res.status(404).json({ message: 'Constraint not found.' });
    res.status(200).json({ message: 'Constraint deleted.' });
  } catch (error) {
    console.error('❌ Error deleting user constraint:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
