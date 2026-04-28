import { query } from '../config/db.js';

export type Pillar = 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';

export interface CanonicalConstraint {
  id: string;
  name: string;
  parent_pillar: Pillar | null;
  aliases: string[];
  description: string | null;
  created_at: Date;
}

/** Full list, alphabetised by name. Curated global vocabulary. */
export const getAllCanonicalConstraints = async (): Promise<CanonicalConstraint[]> => {
  const result = await query(
    `SELECT id, name, parent_pillar, aliases, description, created_at
       FROM canonical_constraints
      ORDER BY name ASC`,
  );
  return result.rows;
};

/** Filter by pillar. Includes NULL parent_pillar entries (cross-pillar constraints). */
export const getCanonicalConstraintsByPillar = async (pillar: Pillar): Promise<CanonicalConstraint[]> => {
  const result = await query(
    `SELECT id, name, parent_pillar, aliases, description, created_at
       FROM canonical_constraints
      WHERE parent_pillar = $1 OR parent_pillar IS NULL
      ORDER BY name ASC`,
    [pillar],
  );
  return result.rows;
};

/**
 * Filter a client-supplied list of UUIDs down to those that exist in the
 * canonical table. Mirrors filterExistingCanonicalIds for positions.
 */
export const filterExistingCanonicalConstraintIds = async (ids: string[]): Promise<string[]> => {
  if (ids.length === 0) return [];
  const result = await query(
    `SELECT id FROM canonical_constraints WHERE id = ANY($1::uuid[])`,
    [ids],
  );
  return result.rows.map(r => r.id as string);
};
