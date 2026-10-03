import { query } from '../config/db.js';

export interface BeltHistoryEntry {
  id: string;
  user_id: string;
  belt_rank: string;
  stripes: number;
  promoted_at: string;
  notes: string | null;
  /** The training entry logged the same day, when there is one (mig 039). */
  session_id: string | null;
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
  // Link to a class logged the same day, if there is one (mig 039). The
  // reverse direction — logging a class after the promotion — is handled by
  // linkSessionToPromotions.
  const result = await query(
    `INSERT INTO belt_history (user_id, belt_rank, stripes, promoted_at, notes, session_id)
     VALUES ($1, $2, $3, $4, $5,
       (SELECT id FROM training_sessions
         WHERE user_id = $1 AND date = $4
         ORDER BY created_at ASC LIMIT 1))
     ON CONFLICT (user_id, belt_rank, stripes) DO UPDATE
       SET promoted_at = EXCLUDED.promoted_at,
           notes       = COALESCE(EXCLUDED.notes, belt_history.notes),
           session_id  = COALESCE(EXCLUDED.session_id, belt_history.session_id)
     RETURNING *`,
    [userId, data.belt_rank, data.stripes, data.promoted_at, data.notes ?? null],
  );
  return result.rows[0] as BeltHistoryEntry;
}

/**
 * The promotion's own words — it is a journal entry in its own right, so
 * this is the only field the user edits after the fact.
 */
export async function updateNotes(
  userId: string,
  entryId: string,
  notes: string | null,
): Promise<BeltHistoryEntry | null> {
  const result = await query(
    `UPDATE belt_history SET notes = $3
      WHERE id = $1 AND user_id = $2
      RETURNING *`,
    [entryId, userId, notes],
  );
  return (result.rows[0] as BeltHistoryEntry) ?? null;
}

/**
 * Called when a session is logged: adopt any of that day's promotions that
 * aren't linked yet, so the order of "tie it on" and "log the class" never
 * matters.
 */
export async function linkSessionToPromotions(
  userId: string,
  sessionId: string,
  date: string,
): Promise<void> {
  await query(
    `UPDATE belt_history SET session_id = $2
      WHERE user_id = $1 AND promoted_at = $3 AND session_id IS NULL`,
    [userId, sessionId, date],
  );
}

export async function deleteEntry(userId: string, entryId: string): Promise<boolean> {
  const result = await query(
    'DELETE FROM belt_history WHERE id = $1 AND user_id = $2',
    [entryId, userId],
  );
  return (result.rowCount ?? 0) > 0;
}
