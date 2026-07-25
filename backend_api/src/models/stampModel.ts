import { query } from '../config/db.js';

export interface EarnedStampRow {
  id: string;
  user_id: string;
  die_key: string;
  auto_earned: boolean;
  struck_at: string;
  created_at: string;
}

// Aggregated view of one die for a user: how many times struck, and the
// first/last strike timestamps. Drives the reveal sheet's "Nth time" meta and
// the collection view's earned/locked state.
export interface StampSummary {
  die_key: string;
  count: number;
  first_struck_at: string;
  last_struck_at: string;
}

export async function getStamps(userId: string): Promise<StampSummary[]> {
  const result = await query(
    `SELECT die_key,
            COUNT(*)::int          AS count,
            MIN(struck_at)         AS first_struck_at,
            MAX(struck_at)         AS last_struck_at
       FROM earned_stamps
      WHERE user_id = $1
      GROUP BY die_key
      ORDER BY MIN(struck_at) ASC`,
    [userId],
  );
  return result.rows as StampSummary[];
}

// Strike a die. Manual dies (autoEarned=false) always insert, so the count
// climbs. Auto-earned dies insert at most once per user — a SELECT-exists guard
// makes the operation idempotent without relying on ON CONFLICT against the
// partial unique index (portable across PG versions). Returns the fresh summary
// for that die so the caller can render "Nth time" without a second round-trip.
export async function strikeStamp(
  userId: string,
  dieKey: string,
  autoEarned: boolean,
): Promise<StampSummary> {
  if (autoEarned) {
    const existing = await query(
      'SELECT 1 FROM earned_stamps WHERE user_id = $1 AND die_key = $2 AND auto_earned = true LIMIT 1',
      [userId, dieKey],
    );
    if (existing.rows.length === 0) {
      await query(
        'INSERT INTO earned_stamps (user_id, die_key, auto_earned) VALUES ($1, $2, true)',
        [userId, dieKey],
      );
    }
  } else {
    await query(
      'INSERT INTO earned_stamps (user_id, die_key, auto_earned) VALUES ($1, $2, false)',
      [userId, dieKey],
    );
  }

  const summary = await query(
    `SELECT die_key,
            COUNT(*)::int  AS count,
            MIN(struck_at) AS first_struck_at,
            MAX(struck_at) AS last_struck_at
       FROM earned_stamps
      WHERE user_id = $1 AND die_key = $2
      GROUP BY die_key`,
    [userId, dieKey],
  );
  return summary.rows[0] as StampSummary;
}
