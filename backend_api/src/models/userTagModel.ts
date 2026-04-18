import { query } from '../config/db.js';

export interface UserTag {
  id: string;
  user_id: string;
  name: string;
  parent_pillar: 'standup' | 'passing' | 'pins' | 'submissions' | 'guard';
  created_at: Date;
}

export const getUserTags = async (userId: string): Promise<UserTag[]> => {
  const result = await query(
    `SELECT * FROM user_tags WHERE user_id = $1 ORDER BY name ASC`,
    [userId],
  );
  return result.rows;
};

export const getUserTagsByIds = async (userId: string, ids: string[]): Promise<UserTag[]> => {
  if (ids.length === 0) return [];
  const result = await query(
    `SELECT * FROM user_tags WHERE user_id = $1 AND id = ANY($2::uuid[])`,
    [userId, ids],
  );
  return result.rows;
};

export const findUserTagByName = async (userId: string, name: string): Promise<UserTag | null> => {
  const result = await query(
    `SELECT * FROM user_tags WHERE user_id = $1 AND name = $2`,
    [userId, name],
  );
  return result.rows[0] ?? null;
};

export const createUserTag = async (
  userId: string,
  name: string,
  parentPillar: string,
): Promise<UserTag> => {
  const result = await query(
    `INSERT INTO user_tags (user_id, name, parent_pillar)
     VALUES ($1, $2, $3)
     RETURNING *`,
    [userId, name, parentPillar],
  );
  return result.rows[0];
};

export const updateUserTag = async (
  userId: string,
  id: string,
  name: string | null,
  parentPillar: string | null,
): Promise<UserTag | null> => {
  // Build dynamic update — only update fields that are provided
  const fields: string[] = [];
  const params: unknown[] = [];
  let i = 1;
  if (name !== null) { fields.push(`name = $${i++}`); params.push(name); }
  if (parentPillar !== null) { fields.push(`parent_pillar = $${i++}`); params.push(parentPillar); }
  if (fields.length === 0) return null;

  params.push(id, userId);
  const result = await query(
    `UPDATE user_tags SET ${fields.join(', ')} WHERE id = $${i++} AND user_id = $${i} RETURNING *`,
    params,
  );
  return result.rows[0] ?? null;
};

export const deleteUserTag = async (userId: string, id: string): Promise<boolean> => {
  // Note: this leaves orphan IDs in training_sessions.user_tag_ids arrays.
  // The frontend filters them out when displaying. Could clean up with a UPDATE
  // statement using array_remove if needed.
  const result = await query(
    `DELETE FROM user_tags WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
};
