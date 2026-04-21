import { query } from '../config/db.js';

export type Pillar = 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';

export interface CanonicalPosition {
  id: string;
  name: string;
  parent_pillar: Pillar;
  aliases: string[];
  created_at: Date;
}

/** Full list, alphabetised by name. Canonical = global; same rows for every user. */
export const getAllCanonicalPositions = async (): Promise<CanonicalPosition[]> => {
  const result = await query(
    `SELECT id, name, parent_pillar, aliases, created_at
       FROM canonical_positions
      ORDER BY name ASC`,
  );
  return result.rows;
};

/** Filtered by pillar. Used when a session's heading is known — reduces payload. */
export const getCanonicalPositionsByPillar = async (pillar: Pillar): Promise<CanonicalPosition[]> => {
  const result = await query(
    `SELECT id, name, parent_pillar, aliases, created_at
       FROM canonical_positions
      WHERE parent_pillar = $1
      ORDER BY name ASC`,
    [pillar],
  );
  return result.rows;
};

/**
 * Filter a client-supplied list of UUIDs down to those that actually exist in
 * the canonical table. Returns the valid subset; unknown IDs are silently dropped
 * (never 400-error — mirrors the sanitizeUserTagIds pattern in sessionController).
 */
export const filterExistingCanonicalIds = async (ids: string[]): Promise<string[]> => {
  if (ids.length === 0) return [];
  const result = await query(
    `SELECT id FROM canonical_positions WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return result.rows.map(r => r.id as string);
};
