import type { Request, Response } from 'express';
import { z } from 'zod';
import { getHistory, addEntry, deleteEntry } from '../models/beltHistoryModel.js';

const BELT_RANKS = ['white', 'blue', 'purple', 'brown', 'black'] as const;

const CreateSchema = z.object({
  belt_rank: z.enum(BELT_RANKS),
  stripes: z.number().int().min(0).max(4).default(0),
  promoted_at: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  notes: z.string().max(500).nullable().optional(),
});

export async function listBeltHistory(req: Request, res: Response) {
  try {
    const entries = await getHistory(req.user.id);
    res.json({ belt_history: entries });
  } catch (err) {
    console.error('listBeltHistory error:', err);
    res.status(500).json({ error: 'Failed to load belt history.' });
  }
}

export async function createBeltHistory(req: Request, res: Response) {
  const parsed = CreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  try {
    const entry = await addEntry(req.user.id, parsed.data);
    res.status(201).json({ entry });
  } catch (err) {
    console.error('createBeltHistory error:', err);
    res.status(500).json({ error: 'Failed to save belt history entry.' });
  }
}

export async function deleteBeltHistory(req: Request, res: Response) {
  try {
    const deleted = await deleteEntry(req.user.id, req.params.id);
    if (!deleted) {
      res.status(404).json({ error: 'Entry not found.' });
      return;
    }
    res.json({ success: true });
  } catch (err) {
    console.error('deleteBeltHistory error:', err);
    res.status(500).json({ error: 'Failed to delete belt history entry.' });
  }
}
