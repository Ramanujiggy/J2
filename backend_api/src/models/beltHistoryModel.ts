import { query } from '../config/db.js';

export interface BeltHistoryEntry {
  id: string;
  user_id: string;
  belt_rank: string;
  stripes: number;
  promoted_at: string;
  notes: string | null;
  created_at: string;
}

export async function getHistory(userId: string): Promise<BeltHistoryEntry[]> {
  const result = await query(
    'SELECT * FROM belt_history WHERE user_id = $1 ORDER BY promoted_at ASC',
    [userId],
  );
  return result.rows as BeltHistoryEntry[];
}

export async function addEntry(
  userId: string,
  data: { belt_rank: string; stripes: number; promoted_at: string; notes?: string | null },
): Promise<BeltHistoryEntry> {
  const result = await query(
    `INSERT INTO belt_history (user_id, belt_rank, stripes, promoted_at, notes)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [userId, data.belt_rank, data.stripes, data.promoted_at, data.notes ?? null],
  );
  return result.rows[0] as BeltHistoryEntry;
}

export async function deleteEntry(userId: string, entryId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM belt_history WHERE id = $1 AND user_id = $2',
    [entryId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
