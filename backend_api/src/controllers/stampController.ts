import type { Request, Response } from 'express';
import { z } from 'zod';
import { getStamps, strikeStamp } from '../models/stampModel.js';
import { isKnownDieKey } from '../lib/stampDieKeys.js';

const StrikeSchema = z.object({
  die_key: z.string().min(1).max(80),
  auto_earned: z.boolean().optional().default(false),
});

export async function listStamps(req: Request, res: Response) {
  try {
    const stamps = await getStamps(req.user!.id);
    res.json({ stamps });
  } catch (err) {
    console.error('listStamps error:', err);
    res.status(500).json({ error: 'Failed to load stamps.' });
  }
}

export async function strikeStampHandler(req: Request, res: Response) {
  const parsed = StrikeSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten().fieldErrors });
    return;
  }
  if (!isKnownDieKey(parsed.data.die_key)) {
    res.status(400).json({ error: 'Unknown die_key.' });
    return;
  }
  try {
    const stamp = await strikeStamp(req.user!.id, parsed.data.die_key, parsed.data.auto_earned);
    res.status(201).json({ stamp });
  } catch (err) {
    console.error('strikeStamp error:', err);
    res.status(500).json({ error: 'Failed to strike stamp.' });
  }
}
