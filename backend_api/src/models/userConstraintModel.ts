import { query } from '../config/db.js';

export type Pillar = 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';

export interface UserConstraint {
  id: string;
  user_id: string;
  name: string;
  parent_pillar: Pillar | null;
  aliases: string[];
  created_at: Date;
}

export const getUserConstraints = async (userId: string): Promise<UserConstraint[]> => {
  const result = await query(
    `SELECT * FROM user_constraints WHERE user_id = $1 ORDER BY name ASC`,
    [userId],
  );
  return result.rows;
};

export const getUserConstraintsByIds = async (userId: string, ids: string[]): Promise<UserConstraint[]> => {
  if (ids.length === 0) return [];
  const result = await query(
    `SELECT * FROM user_constraints WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, ids],
  );
  return result.rows;
};

/**
 * Idempotent create — same pattern as upsertUserTag. Concurrent calls with
 * the same (user_id, name) resolve to the same row. Returns `created: true`
 * when the row was newly inserted, `false` when an existing row was returned.
 *
 * `parent_pillar` is nullable for constraints (some span multiple pillars).
 */
export const upsertUserConstraint = async (
  userId: string,
  name: string,
  parentPillar: Pillar | null,
): Promise<{ constraint: UserConstraint; created: boolean }> => {
  const result = await query(
    `INSERT INTO user_constraints (user_id, name, parent_pillar)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *, (xmax = 0) AS created`,
    [userId, name, parentPillar],
  );
  const row = result.rows[0];
  return { constraint: row, created: row.created === true };
};

export const deleteUserConstraint = async (userId: string, id: string): Promise<boolean> => {
  // Same orphan-tolerance as deleteUserTag — orphan IDs in
  // training_sessions.user_constraint_ids are filtered out on read.
  const result = await query(
    `DELETE FROM user_constraints WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
};
