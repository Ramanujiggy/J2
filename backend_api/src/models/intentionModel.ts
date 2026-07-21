import type { PoolClient } from 'pg';
import { query } from '../config/db.js';

// Executor interface — either the shared pool (via `query`) or a transaction client.
// Allows these model functions to participate in a caller-managed transaction.
interface Executor {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}
const defaultExec: Executor = { query };

export type CompletionType = 'days' | 'sessions' | 'training_weeks';

export interface Intention {
  id: string;
  user_id: string;
  week_start: string; // YYYY-MM-DD (start date of this intention — not necessarily a Monday)
  intent_label: string;
  intent_category: 'technical' | 'physical' | 'mental' | 'positional' | 'competitive' | null;
  heading: string | null; // Prism vertex: standup/passing/pins/submissions/guard
  duration_days: number;
  /**
   * Completion mode (mig 034).
   *   • 'days'           — duration_days is authoritative (legacy behavior)
   *   • 'sessions'       — completes once `target_count` sessions touching
   *                        `heading` have been logged on or after week_start
   *   • 'training_weeks' — completes once `target_count` distinct ISO weeks
   *                        containing >= 1 session have elapsed since week_start
   * For non-'days' modes, `duration_days` acts as a soft calendar ceiling
   * so an unreached target doesn't keep the intention "active" forever.
   */
  completion_type: CompletionType;
  /** Target for 'sessions' / 'training_weeks'. NULL when completion_type='days'. */
  target_count: number | null;
  user_tag_ids: string[] | null;
  journal_entry: string | null;
  created_at: Date;
}

export const createIntention = async (
  userId: string,
  weekStart: string,
  intentLabel: string,
  intentCategory: string | null,
  heading: string | null,
  durationDays: number,
  completionType: CompletionType = 'days',
  targetCount: number | null = null,
  userTagIds: string[] | null = null,
  exec: Executor | PoolClient = defaultExec,
): Promise<Intention> => {
  const result = await exec.query(
    `INSERT INTO weekly_intentions
       (user_id, week_start, intent_label, intent_category, heading,
        duration_days, completion_type, target_count, user_tag_ids)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING *`,
    [userId, weekStart, intentLabel, intentCategory, heading, durationDays, completionType, targetCount, userTagIds],
  );
  return (result.rows[0] as Intention);
};

// Shorten an intention so its end date becomes `newEndDate` (for mid-week pivots)
export const shortenIntention = async (
  userId: string,
  id: string,
  newDurationDays: number,
  exec: Executor | PoolClient = defaultExec,
): Promise<Intention | null> => {
  const result = await exec.query(
    `UPDATE weekly_intentions SET duration_days = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [newDurationDays, id, userId],
  );
  return (result.rows[0] as Intention | undefined) ?? null;
};

// Find any active intention whose date range includes today.
// When called inside a transaction with `forUpdate=true`, locks the row so
// concurrent pivots serialise (prevents double-shorten / duplicate-create races).
export const getActiveIntention = async (
  userId: string,
  todayStr: string,
  exec: Executor | PoolClient = defaultExec,
  forUpdate = false,
): Promise<Intention | null> => {
  const result = await exec.query(
    `SELECT * FROM weekly_intentions
     WHERE user_id = $1
       AND week_start <= $2
       AND (week_start::date + (duration_days - 1) * INTERVAL '1 day')::date >= $2::date
     ORDER BY week_start DESC
     LIMIT 1
     ${forUpdate ? 'FOR UPDATE' : ''}`,
    [userId, todayStr],
  );
  return (result.rows[0] as Intention | undefined) ?? null;
};

export const getAllIntentions = async (userId: string): Promise<Intention[]> => {
  const result = await query(
    `SELECT * FROM weekly_intentions WHERE user_id = $1 ORDER BY week_start DESC`,
    [userId],
  );
  return result.rows;
};

export const getIntentionByWeek = async (
  userId: string,
  weekStart: string,
): Promise<Intention | null> => {
  const result = await query(
    `SELECT * FROM weekly_intentions WHERE user_id = $1 AND week_start = $2`,
    [userId, weekStart],
  );
  return result.rows[0] ?? null;
};

export const updateJournalEntry = async (
  userId: string,
  id: string,
  journalEntry: string,
): Promise<Intention | null> => {
  const result = await query(
    `UPDATE weekly_intentions SET journal_entry = $1 WHERE id = $2 AND user_id = $3 RETURNING *`,
    [journalEntry, id, userId],
  );
  return result.rows[0] ?? null;
};

export const updateIntention = async (
  userId: string,
  id: string,
  intentLabel: string,
  intentCategory: string | null,
  heading: string | null,
  durationDays: number,
  completionType: CompletionType = 'days',
  targetCount: number | null = null,
  userTagIds: string[] | null = null,
): Promise<Intention | null> => {
  const result = await query(
    `UPDATE weekly_intentions
     SET intent_label = $1, intent_category = $2, heading = $3,
         duration_days = $4, completion_type = $5, target_count = $6,
         user_tag_ids = $7
     WHERE id = $8 AND user_id = $9
     RETURNING *`,
    [intentLabel, intentCategory, heading, durationDays, completionType, targetCount, userTagIds, id, userId],
  );
  return result.rows[0] ?? null;
};

export const deleteIntention = async (userId: string, id: string): Promise<boolean> => {
  const result = await query(
    `DELETE FROM weekly_intentions WHERE id = $1 AND user_id = $2`,
    [id, userId],
  );
  return (result.rowCount ?? 0) > 0;
};
