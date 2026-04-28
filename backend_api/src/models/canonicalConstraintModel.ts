import { query } from '../config/db.js';

export type Pillar = 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';

// Rich metadata payload for a CLA game (mig 017). Strongly typed so the
// frontend can render the future Constraints Library page without guessing.
// Optional throughout — older rows without details still load cleanly.
export interface ConstraintDetails {
  family?: string;
  full_label?: string;
  your_role?:
    | 'guard_player'
    | 'pin_escaper'
    | 'top_passer'
    | 'pin_holder'
    | 'back_attacker'
    | 'back_escaper'
    | 'turtle_attacker'
    | 'turtle_defender'
    | 'standing';
  start_position?: string;
  continuous_goals?: { top?: string; bottom?: string };
  terminal_goals?:  { top?: string; bottom?: string };
  reset_condition?: string;
  difficulty?: 'low' | 'medium' | 'high' | 'mixed';
  recommended_level?: string;
  duration_minutes?: number;
  cues?: string[];
  metrics?: string[];
  common_errors?: string;
  safety_notes?: string;
  progression?: string;
  regression?: string;
  source?: string;
  roulette_eligible?: boolean;
}

export interface CanonicalConstraint {
  id: string;
  name: string;
  parent_pillar: Pillar | null;
  aliases: string[];
  description: string | null;
  details: ConstraintDetails | null;
  created_at: Date;
}

/** Full list, alphabetised by name. Curated global vocabulary. */
export const getAllCanonicalConstraints = async (): Promise<CanonicalConstraint[]> => {
  const result = await query(
    `SELECT id, name, parent_pillar, aliases, description, details, created_at
       FROM canonical_constraints
      ORDER BY name ASC`,
  );
  return result.rows;
};

/** Filter by pillar. Includes NULL parent_pillar entries (cross-pillar constraints). */
export const getCanonicalConstraintsByPillar = async (pillar: Pillar): Promise<CanonicalConstraint[]> => {
  const result = await query(
    `SELECT id, name, parent_pillar, aliases, description, details, created_at
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
