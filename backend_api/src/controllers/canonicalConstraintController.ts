import type { Request, Response } from 'express';
import { createHash } from 'node:crypto';
import {
  getAllCanonicalConstraints,
  getCanonicalConstraintsByPillar,
  type Pillar,
} from '../models/canonicalConstraintModel.js';

const VALID_PILLARS = new Set<Pillar>(['standup', 'passing', 'pins', 'submissions', 'guard']);

// GET /api/canonical-constraints[?pillar=guard]
// Curated global vocabulary of CLA rule modifications. Read-only to users.
// ETag + 1-hour Cache-Control matches the canonical-positions endpoint —
// the library mutates rarely (admin tooling / migrations).
export const getCanonicalConstraints = async (req: Request, res: Response): Promise<void> => {
  try {
    const pillarRaw = typeof req.query.pillar === 'string' ? req.query.pillar : null;
    const constraints = pillarRaw && VALID_PILLARS.has(pillarRaw as Pillar)
      ? await getCanonicalConstraintsByPillar(pillarRaw as Pillar)
      : await getAllCanonicalConstraints();

    const etag = 'W/"' + createHash('sha1')
      .update(constraints.map(c => `${c.id}:${c.name}`).join('|'))
      .digest('base64')
      .slice(0, 20) + '"';

    if (req.headers['if-none-match'] === etag) {
      res.status(304).end();
      return;
    }

    res.setHeader('ETag', etag);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.status(200).json({ constraints });
  } catch (error) {
    console.error('❌ Error fetching canonical constraints:', error);
    res.status(500).json({ message: 'Server error' });
  }
};
