import type { PoolClient } from 'pg';
import { query } from '../config/db.js';

// Executor interface — either the shared pool (via `query`) or a transaction client.
// Allows these model functions to participate in a caller-managed transaction.
interface Executor {
  query: (text: string, params?: unknown[]) => Promise<{ rows: unknown[]; rowCount: number | null }>;
}
const defaultExec: Executor = { query };

export interface Intention {
  id: string;
  user_id: string;
  week_start: string; // YYYY-MM-DD (start date of this intention — not necessarily a Monday)
  intent_label: string;
  intent_category: 'technical' | 'physical' | 'mental' | 'positional' | 'competitive' | null;
  heading: string | null; // Prism vertex: standup/passing/pins/submissions/guard
  duration_days: number;
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
  exec: Executor | PoolClient = defaultExec,
): Promise<Intention> => {
  const result = await exec.query(
    `INSERT INTO weekly_intentions (user_id, week_start, intent_label, intent_category, heading, duration_days)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [userId, weekStart, intentLabel, intentCategory, heading, durationDays],
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
): Promise<Intention | null> => {
  const result = await query(
    `UPDATE weekly_intentions
     SET intent_label = $1, intent_category = $2, heading = $3, duration_days = $4
     WHERE id = $5 AND user_id = $6
     RETURNING *`,
    [intentLabel, intentCategory, heading, durationDays, id, userId],
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
