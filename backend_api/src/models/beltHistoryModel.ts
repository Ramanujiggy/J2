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

/** Newest first — callers treat [0] as the current position. */
export async function getHistory(userId: string): Promise<BeltHistoryEntry[]> {
  const result = await query(
    'SELECT * FROM belt_history WHERE user_id = $1 ORDER BY promoted_at DESC, created_at DESC',
    [userId],
  );
  return result.rows as BeltHistoryEntry[];
}

/**
 * A promotion is a position on the ladder (rank + stripes) and a person
 * holds each position once, so this is an upsert on (user, rank, stripes):
 * tying on a position you already hold re-dates it instead of stacking a
 * duplicate. Notes are only replaced when new ones are supplied.
 * (Migration 038 carries the unique constraint.)
 */
export async function addEntry(
  userId: string,
  data: { belt_rank: string; stripes: number; promoted_at: string; notes?: string | null },
): Promise<BeltHistoryEntry> {
  const result = await query(
    `INSERT INTO belt_history (user_id, belt_rank, stripes, promoted_at, notes)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (user_id, belt_rank, stripes) DO UPDATE
       SET promoted_at = EXCLUDED.promoted_at,
           notes       = COALESCE(EXCLUDED.notes, belt_history.notes)
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
