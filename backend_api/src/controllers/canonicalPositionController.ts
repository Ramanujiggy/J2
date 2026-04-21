import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import { getAllCanonicalPositions, getCanonicalPositionsByPillar, type Pillar } from '../models/canonicalPositionModel.js';

const VALID_PILLARS = new Set<Pillar>(['standup', 'passing', 'pins', 'submissions', 'guard']);

// GET /api/canonical-positions[?pillar=guard]
// Curated global BJJ-position vocabulary. Read-only to users; mutated only via
// new migrations or admin tooling. Cached aggressively — this endpoint hits on
// every Log Session + Session Detail open.
export const getCanonicalPositions = async (req: Request, res: Response): Promise<void> => {
  try {
    const pillarRaw = typeof req.query.pillar === 'string' ? req.query.pillar : null;
    const positions = pillarRaw && VALID_PILLARS.has(pillarRaw as Pillar)
      ? await getCanonicalPositionsByPillar(pillarRaw as Pillar)
      : await getAllCanonicalPositions();

    // Weak ETag over id+name — cheap hash that invalidates if any row changes.
    const etag = 'W/"' + createHash('sha1')
      .update(positions.map(p => `${p.id}:${p.name}`).join('|'))
      .digest('base64')
      .slice(0, 20) + '"';

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.status(200).json({ positions });
  } catch (error) {
    console.error('❌ Error fetching canonical positions:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
